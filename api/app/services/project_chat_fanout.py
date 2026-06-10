"""Project chat realtime fanout boundary."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Protocol, cast
from uuid import UUID, uuid4

from loguru import logger
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import settings
from app.core.exceptions import RedisConnectionException, RedisDataValidationException


PROJECT_CHAT_FANOUT_CHANNEL = "project-chat:messages"


class ProjectChatConnection(Protocol):
    """Minimal socket behavior required by project chat fanout."""

    async def send_json(self, data: object) -> None:
        """Send a JSON payload to the connection."""
        ...


class ProjectChatFanoutBroker(Protocol):
    """Broker boundary for cross-worker chat fanout."""

    async def publish(self, event: dict[str, object]) -> None:
        """Publish a project chat event for all workers."""
        ...

    def subscribe(self) -> AsyncIterator[dict[str, object]]:
        """Subscribe to project chat events from all workers."""
        ...

    async def aclose(self) -> None:
        """Close broker resources."""
        ...


class RedisProjectChatFanoutBroker:
    """Redis pub/sub broker for project chat realtime events."""

    def __init__(
        self, redis_url: str, channel: str = PROJECT_CHAT_FANOUT_CHANNEL
    ) -> None:
        """Initialize the Redis broker without opening a connection."""
        self._redis_url = redis_url
        self._channel = channel
        self._client: Redis | None = None
        self._lock = asyncio.Lock()

    async def _get_client(self) -> Redis:
        if self._client is not None:
            return self._client

        async with self._lock:
            if self._client is None:
                self._client = Redis.from_url(self._redis_url, decode_responses=True)

        return self._client

    async def publish(self, event: dict[str, object]) -> None:
        """Publish one chat fanout event through Redis."""
        client = await self._get_client()
        try:
            await client.publish(self._channel, json.dumps(event))
        except (TypeError, RedisError) as exc:
            message = "Failed to publish project chat realtime event"
            raise RedisConnectionException(message, exc) from exc

    async def subscribe(self) -> AsyncIterator[dict[str, object]]:
        """Yield chat fanout events received through Redis pub/sub."""
        client = await self._get_client()
        pubsub = client.pubsub()
        try:
            await pubsub.subscribe(self._channel)
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue

                raw_data = message.get("data")
                if not isinstance(raw_data, str):
                    continue

                try:
                    payload = json.loads(raw_data)
                except json.JSONDecodeError as exc:
                    raise RedisDataValidationException(
                        "Project chat fanout event is not valid JSON", exc
                    ) from exc

                if not isinstance(payload, dict):
                    raise RedisDataValidationException(
                        "Project chat fanout event must be a JSON object"
                    )

                yield cast("dict[str, object]", payload)
        except RedisError as exc:
            message = "Failed to subscribe to project chat realtime events"
            raise RedisConnectionException(message, exc) from exc
        finally:
            await pubsub.aclose()

    async def aclose(self) -> None:
        """Close the Redis client used by project chat fanout."""
        client = self._client
        self._client = None
        if client is not None:
            await client.aclose()


class ProjectChatFanout:
    """Project-scoped fanout that hides broker implementation details."""

    def __init__(self, broker: ProjectChatFanoutBroker) -> None:
        """Initialize empty local socket registries."""
        self._broker = broker
        self._worker_id = str(uuid4())
        self._connections: dict[UUID, set[ProjectChatConnection]] = {}
        self._lock = asyncio.Lock()
        self._subscriber_task: asyncio.Task[None] | None = None

    async def connect(self, project_id: UUID, websocket: ProjectChatConnection) -> None:
        """Register a local WebSocket for project broadcasts."""
        async with self._lock:
            self._connections.setdefault(project_id, set()).add(websocket)
            self._ensure_subscriber_locked()

    async def disconnect(
        self, project_id: UUID, websocket: ProjectChatConnection
    ) -> None:
        """Remove a local WebSocket from project broadcasts."""
        async with self._lock:
            project_connections = self._connections.get(project_id)
            if project_connections is None:
                return
            project_connections.discard(websocket)
            if not project_connections:
                self._connections.pop(project_id, None)

    async def broadcast(self, project_id: UUID, payload: dict[str, object]) -> None:
        """Publish a persisted project chat payload to every worker."""
        await self._broker.publish(
            {
                "project_id": str(project_id),
                "payload": payload,
                "origin_worker_id": self._worker_id,
            }
        )
        await self._send_local(project_id, payload)

    async def aclose(self) -> None:
        """Stop background subscription work and close broker resources."""
        subscriber_task = self._subscriber_task
        self._subscriber_task = None
        if subscriber_task is not None:
            subscriber_task.cancel()
            try:
                await subscriber_task
            except asyncio.CancelledError:
                pass

        await self._broker.aclose()

    def _ensure_subscriber_locked(self) -> None:
        if self._subscriber_task is None or self._subscriber_task.done():
            self._subscriber_task = asyncio.create_task(self._listen())

    async def _listen(self) -> None:
        try:
            async for event in self._broker.subscribe():
                if event.get("origin_worker_id") == self._worker_id:
                    continue

                project_id = event.get("project_id")
                payload = event.get("payload")
                if not isinstance(project_id, str) or not isinstance(payload, dict):
                    continue

                await self._send_local(
                    UUID(project_id), cast("dict[str, object]", payload)
                )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("Project chat fanout subscriber stopped: {}", exc)

    async def _send_local(self, project_id: UUID, payload: dict[str, object]) -> None:
        async with self._lock:
            project_connections = list(self._connections.get(project_id, ()))

        stale_connections: list[ProjectChatConnection] = []
        for connection in project_connections:
            try:
                await connection.send_json(payload)
            except RuntimeError:
                stale_connections.append(connection)

        for connection in stale_connections:
            await self.disconnect(project_id, connection)


project_chat_fanout = ProjectChatFanout(
    RedisProjectChatFanoutBroker(settings.redis_url)
)
