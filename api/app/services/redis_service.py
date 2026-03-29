from __future__ import annotations

import asyncio
import json
from typing import TypeVar, cast

from pydantic import BaseModel, ValidationError
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.config import get_settings
from app.exceptions import (
    RedisConnectionException,
    RedisDataValidationException,
    RedisKeyAlreadyExistsException,
    RedisKeyNotFoundException,
)

settings = get_settings()

ModelT = TypeVar("ModelT", bound=BaseModel)
JsonScalar = str | int | float | bool | None
JsonValue = JsonScalar | list["JsonValue"] | dict[str, "JsonValue"]
JsonObject = dict[str, JsonValue]

_redis_client: Redis | None = None
_redis_lock = asyncio.Lock()


class RedisService:
    """Store and retrieve JSON-backed Pydantic models through a shared async Redis client."""

    async def _get_client(self) -> Redis:
        """Return the shared Redis client, creating it lazily on first use."""
        global _redis_client

        if _redis_client is not None:
            return _redis_client

        async with _redis_lock:
            if _redis_client is None:
                _redis_client = Redis.from_url(
                    settings.redis_url, decode_responses=True
                )

        return _redis_client

    def _model_to_json_object(self, value: BaseModel) -> JsonObject:
        """Convert a Pydantic model into the JSON object shape stored in Redis."""
        payload = value.model_dump(mode="json")

        if not isinstance(payload, dict):
            message = "Redis service only supports Pydantic models with an object-shaped root payload"
            raise RedisDataValidationException(message)

        return cast(JsonObject, payload)

    def _load_json_object(self, key: str, raw_value: str) -> JsonObject:
        """Deserialize a Redis JSON string into an object-shaped dictionary."""
        try:
            payload = json.loads(raw_value)
        except json.JSONDecodeError as exc:
            message = f"Redis data for key '{key}' is not valid JSON"
            raise RedisDataValidationException(message, exc) from exc

        if not isinstance(payload, dict):
            message = f"Redis data for key '{key}' must be a JSON object"
            raise RedisDataValidationException(message)

        return cast(JsonObject, payload)

    async def create(self, key: str, value: ModelT) -> ModelT:
        """Create a Redis document from a Pydantic model and return the stored model instance."""
        payload = self._model_to_json_object(value)
        model_type = value.__class__
        client = await self._get_client()

        try:
            created = await client.set(key, json.dumps(payload), nx=True)
        except RedisError as exc:
            message = f"Failed to create Redis data for key '{key}'"
            raise RedisConnectionException(message, exc) from exc

        if not created:
            message = f"Redis key already exists: {key}"
            raise RedisKeyAlreadyExistsException(message)

        return model_type.model_validate(payload)

    async def put(
        self,
        key: str,
        value: ModelT,
        ttl_seconds: int | None = None,
    ) -> ModelT:
        """Store or overwrite a Redis document, optionally applying a TTL."""
        payload = self._model_to_json_object(value)
        model_type = value.__class__
        client = await self._get_client()

        try:
            await client.set(key, json.dumps(payload), ex=ttl_seconds)
        except RedisError as exc:
            message = f"Failed to store Redis data for key '{key}'"
            raise RedisConnectionException(message, exc) from exc

        return model_type.model_validate(payload)

    async def get(self, key: str, model_type: type[ModelT]) -> ModelT | None:
        """Fetch a Redis document by key and validate it into the requested Pydantic model."""
        client = await self._get_client()

        try:
            raw_value = await client.get(key)
        except RedisError as exc:
            message = f"Failed to read Redis data for key '{key}'"
            raise RedisConnectionException(message, exc) from exc

        if raw_value is None:
            return None

        payload = self._load_json_object(key, raw_value)

        try:
            return model_type.model_validate(payload)
        except ValidationError as exc:
            message = f"Redis data for key '{key}' could not be validated as {model_type.__name__}"
            raise RedisDataValidationException(message, exc) from exc

    async def patch(
        self, key: str, updates: BaseModel, model_type: type[ModelT]
    ) -> ModelT:
        """Apply a shallow top-level patch and return the updated Pydantic model."""
        current_value = await self.get(key, model_type)
        if current_value is None:
            message = f"Redis key was not found: {key}"
            raise RedisKeyNotFoundException(message)

        current_payload = self._model_to_json_object(current_value)
        updates_payload = updates.model_dump(exclude_unset=True, mode="json")

        if not isinstance(updates_payload, dict):
            message = "Redis patch updates must serialize to a JSON object"
            raise RedisDataValidationException(message)

        merged_payload = {
            **current_payload,
            **cast(JsonObject, updates_payload),
        }

        try:
            validated = model_type.model_validate(merged_payload)
        except ValidationError as exc:
            message = f"Patched Redis data for key '{key}' could not be validated as {model_type.__name__}"
            raise RedisDataValidationException(message, exc) from exc

        client = await self._get_client()

        try:
            await client.set(key, json.dumps(self._model_to_json_object(validated)))
        except RedisError as exc:
            message = f"Failed to update Redis data for key '{key}'"
            raise RedisConnectionException(message, exc) from exc

        return validated

    async def delete(self, key: str) -> bool:
        """Delete a Redis document and report whether the key existed."""
        client = await self._get_client()

        try:
            deleted = await client.delete(key)
        except RedisError as exc:
            message = f"Failed to delete Redis data for key '{key}'"
            raise RedisConnectionException(message, exc) from exc

        return deleted > 0

    async def aclose(self) -> None:
        """Close and reset the shared Redis client used by the service."""
        global _redis_client

        client = _redis_client
        _redis_client = None

        if client is None:
            return

        try:
            await client.aclose()
        except RedisError as exc:
            message = "Failed to close the shared Redis client"
            raise RedisConnectionException(message, exc) from exc


redis_service = RedisService()
