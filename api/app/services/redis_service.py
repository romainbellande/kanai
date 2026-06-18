"""Provide Redis-backed storage for JSON-serialized Pydantic models."""

from __future__ import annotations

import asyncio
import json
from typing import TypeVar, cast

from pydantic import BaseModel, ValidationError
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings
from app.core.exceptions import (
    RedisConnectionException,
    RedisDataValidationException,
)

settings = get_settings()

ModelT = TypeVar("ModelT", bound=BaseModel)
JsonScalar = str | int | float | bool | None
JsonValue = JsonScalar | list["JsonValue"] | dict[str, "JsonValue"]
JsonObject = dict[str, JsonValue]

_redis_client: Redis | None = None
_redis_lock = asyncio.Lock()


class RedisService:
    """Store and retrieve JSON-backed Pydantic models through Redis.

    The service uses a lazily initialized shared async Redis client and validates
    stored payloads through the provided Pydantic model types.
    """

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

    def _validate_ttl_seconds(self, ttl_seconds: int | None) -> None:
        if ttl_seconds is not None and ttl_seconds <= 0:
            message = "Redis TTL must be greater than zero"
            raise RedisDataValidationException(message)

    async def put(
        self,
        key: str,
        value: ModelT,
        ttl_seconds: int | None = None,
    ) -> ModelT:
        """Store or overwrite a Redis document, optionally applying a TTL.

        Args:
            key: Redis key used to store the serialized model.
            value: Pydantic model instance to serialize and store.
            ttl_seconds: Optional expiration time in seconds. Defaults to `None`.

        Returns:
            Stored model instance validated from the serialized payload.

        Raises:
            RedisConnectionException: If Redis rejects or cannot complete the write.
            RedisDataValidationException: If `value` cannot serialize to a JSON object
                or `ttl_seconds` is not greater than zero.
        """
        self._validate_ttl_seconds(ttl_seconds)
        payload = self._model_to_json_object(value)
        model_type = value.__class__
        client = await self._get_client()

        try:
            await client.set(
                key,
                json.dumps(payload),
                ex=ttl_seconds,
                keepttl=ttl_seconds is None,
            )
        except RedisError as exc:
            message = f"Failed to store Redis data for key '{key}'"
            raise RedisConnectionException(message, exc) from exc

        return model_type.model_validate(payload)

    async def get(self, key: str, model_type: type[ModelT]) -> ModelT | None:
        """Fetch a Redis document by key and validate it into a Pydantic model.

        Args:
            key: Redis key to read.
            model_type: Pydantic model type used to validate the stored payload.

        Returns:
            Validated model instance, or `None` when `key` does not exist.

        Raises:
            RedisConnectionException: If Redis rejects or cannot complete the read.
            RedisDataValidationException: If stored data is not a JSON object or
                cannot be validated as `model_type`.
        """
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

    async def delete(self, key: str) -> bool:
        """Delete a Redis document.

        Args:
            key: Redis key to delete.

        Returns:
            `True` when a key was deleted, otherwise `False`.

        Raises:
            RedisConnectionException: If Redis rejects or cannot complete the delete.
        """
        client = await self._get_client()

        try:
            deleted = await client.delete(key)
        except RedisError as exc:
            message = f"Failed to delete Redis data for key '{key}'"
            raise RedisConnectionException(message, exc) from exc

        return deleted > 0

    async def aclose(self) -> None:
        """Close and reset the shared Redis client used by the service.

        Raises:
            RedisConnectionException: If Redis rejects or cannot complete the close.
        """
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
