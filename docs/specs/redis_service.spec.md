# Redis Service

## Summary

Implement a reusable async Redis service under `app/services` for storing JSON documents by key.
The service must expose `create`, `patch`, `get`, and `delete`, use a shared Redis connection across the process, accept Pydantic `BaseModel` values in its public API, and be covered by pytest tests that run through `just tests`.

## Goals

- Provide a single Redis integration point for the backend.
- Keep the service fully async.
- Reuse one Redis client / connection pool across all consumers instead of creating ad hoc connections.
- Support JSON document storage with partial updates.
- Support Pydantic model input and model reconstruction on reads and updates.
- Follow the existing backend patterns in `app/config.py`, `app/services/database_service.py`, and `main.py`.

## Non-Goals

- Expose the full Redis command surface.
- Add feature-specific caching behavior.
- Add key scanning, bulk operations, pub/sub, streams, or TTL management in this iteration.
- Support non-document root values such as lists or scalar strings.

## Data Model

- Each Redis key maps to one JSON document.
- A document is a JSON-serializable object with a dictionary-like root shape.
- The service stores documents as JSON strings in Redis.
- Public methods should accept Pydantic `BaseModel` instances where a payload is required.
- Public methods should reconstruct and return a Pydantic model when the concrete model type is available.
- `patch` applies a shallow partial update to the top-level document fields.

Example:

```json
{
  "id": "user-123",
  "name": "Naimor",
  "preferences": {
    "theme": "dark"
  }
}
```

`patch({"name": "Updated"})` updates only `name` and keeps all other existing top-level fields unchanged.

## Implementation Shape

Create `app/services/redis_service.py` with:

- A `RedisService` class that exposes the public methods.
- A module-level shared async Redis client, created lazily on first use.
- A module-level async lock that prevents duplicate client creation under concurrent first access.
- A module-level service instance, for example `redis_service = RedisService()`, so future modules can reuse the same service object.
- Docstrings on the service class, lifecycle helpers, and each public method so callers can understand usage, inputs, return values, and failure cases from the code itself.

Use the official asyncio Redis client from the `redis` package, via `redis.asyncio`.

## Configuration

Update `app/config.py`:

- Add a required `redis_url: str` field to `Settings`.
- Keep using the existing cached `get_settings()` pattern.
- The Redis service must read `settings.redis_url` instead of accepting a raw URL in application code.

Expected environment variable:

- `REDIS_URL`

Example value:

- `redis://localhost:6379/0`

## Connection Lifecycle

- The Redis client must be shared across the application process.
- The service must not create a new client per request or per method call.
- Client initialization should be lazy so importing the module does not force an immediate network connection.
- The service must expose a cleanup function or method that closes the shared client cleanly.
- `main.py` should integrate Redis cleanup into the existing FastAPI lifespan function.

Expected behavior:

1. The first service call initializes the shared async Redis client.
2. Later calls reuse the same client / connection pool.
3. Application shutdown closes the client.

## Public API Contract

The service should operate on caller-provided Redis keys and Pydantic model payloads.
Redis storage remains JSON-based, but conversion to and from dictionaries happens inside the service.

Suggested signatures:

```python
async def create[T: BaseModel](self, key: str, value: T) -> T: ...
async def patch[T: BaseModel](self, key: str, updates: BaseModel, model_type: type[T]) -> T: ...
async def get[T: BaseModel](self, key: str, model_type: type[T]) -> T | None: ...
async def delete(self, key: str) -> bool: ...
```

Type exactness may be adjusted during implementation to match Python and Pydantic typing constraints, but the external behavior must stay the same.

### Model Conversion Rules

- `create` accepts a concrete `BaseModel` instance and serializes it with Pydantic before writing to Redis.
- `patch` accepts a Pydantic model carrying only the fields to update, converts that model to a dictionary, merges it into the stored document, and validates the merged document back into the requested model type.
- `get` reads JSON from Redis, converts it to a dictionary, and validates it into the requested model type.
- `delete` remains key-based and does not require a model.
- Redis should never receive raw Pydantic objects; all writes must serialize through Pydantic first.
- Returned values for `create`, `patch`, and `get` should be Pydantic model instances, not dictionaries.

### `create`

- Creates a new JSON document at `key` from a Pydantic model instance.
- Serializes the payload to a dictionary and then JSON before writing to Redis.
- Must fail if the key already exists.
- Returns the created document.

Required behavior:

- Use Redis semantics equivalent to `SET key value NX` so creation is atomic.
- Raise a clear service-level error when the key already exists.

### `patch`

- Loads the existing document for `key`.
- Converts the patch model to a dictionary that contains only the explicitly set fields.
- Applies a shallow merge of those fields into the current document.
- Writes the merged document back to Redis.
- Returns the updated document as the requested Pydantic model type.
- This version may use last-write-wins behavior; optimistic locking is not required.

Required behavior:

- Must fail if the key does not exist.
- Must reject non-object stored values if encountered unexpectedly.
- Only merges top-level fields in this version.
- The merge should be performed on dictionary data derived from Pydantic models.

Example:

Existing document:

```json
{
  "name": "before",
  "enabled": true,
  "count": 1
}
```

Patch payload:

```json
{
  "name": "after",
  "count": 2
}
```

Result:

```json
{
  "name": "after",
  "enabled": true,
  "count": 2
}
```

### `get`

- Reads the key from Redis.
- Deserializes the JSON document.
- Validates the result into the requested Pydantic model type.
- Returns `None` when the key does not exist.

### `delete`

- Deletes the key from Redis.
- Returns `True` when a key was deleted.
- Returns `False` when the key did not exist.

## Errors

The implementation should make service-level failure modes explicit instead of leaking ambiguous behavior to callers.

Minimum required error cases:

- create on an existing key
- patch on a missing key
- invalid or non-object JSON stored at a managed key
- stored JSON cannot be validated into the requested Pydantic model
- Redis connection or command failure

The exact exception classes may be introduced during implementation. A small `app/exceptions.py` expansion is acceptable if needed, but keep it minimal and focused.

## Testing Requirements

Add pytest coverage under `tests/`.

Tests must cover at least:

- `create` accepts a Pydantic model, stores it, and returns the same model type
- `create` fails when the key already exists
- `get` returns the stored value as the requested Pydantic model type
- `get` returns `None` for a missing key
- `patch` accepts a patch model, merges top-level fields correctly, and returns the requested Pydantic model type
- `patch` fails when the key is missing
- validation failure is surfaced when stored data cannot be reconstructed as the requested model
- `delete` returns `True` when a key existed
- `delete` returns `False` when a key was absent
- repeated service access reuses the same shared client object
- shutdown cleanup closes or resets the shared client state

## Testing Strategy

- Tests must run through `just tests`.
- Do not require a developer-managed Redis server for the test suite.
- Prefer a deterministic test approach using `fakeredis` with async support, or an equivalent async-safe test double.
- If the implementation uses module-level shared state, tests must reset that state between cases to avoid leakage.

## Project Changes Expected

Implementation of this spec should include:

- dependency updates in `pyproject.toml`
  - runtime dependency for `redis`
  - dev dependency for `fakeredis` if used for tests
- config update in `app/config.py`
- new service module in `app/services/redis_service.py`
- lifespan update in `main.py` for cleanup
- new tests under `tests/`

## Acceptance Criteria

- A Redis service exists at `app/services/redis_service.py`.
- The service is fully async.
- The service exposes `create`, `patch`, `get`, and `delete`.
- The service stores JSON object documents by key.
- `create`, `patch`, and `get` are model-aware and use Pydantic conversion internally for Redis compatibility.
- Redis connection reuse is implemented through a shared client / pool.
- `REDIS_URL` is defined in `app/config.py` and used by the service.
- The Redis service implementation includes docstrings for its public API and lifecycle helpers.
- Tests cover the required behaviors and pass via `just tests`.

## Open Decisions Resolved By This Spec

- Stored values are JSON documents, not raw strings or Redis hashes.
- `patch` is a shallow top-level merge.
- `create` is create-only, not upsert.
- `get` returns `None` for missing keys.
- `create` returns the concrete model instance type it receives.
- `patch` and `get` return a concrete Pydantic model when the caller supplies the model type.
- `delete` returns a boolean indicating whether anything was removed.
- The Redis client is lazy, shared, and explicitly cleaned up on shutdown.
