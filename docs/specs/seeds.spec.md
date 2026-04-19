# Seeds Specification

## Goal

Add a generic database seeding module under `app/modules/seeder/` that can populate development reference data automatically during application startup.

The seeding system is for local and dev environments, not for production data migration or large fake-data generation.

## Expected Outcome

- seed execution happens automatically during app startup
- seeding only runs in safe environments such as `local` and `dev`
- rerunning the app must be safe and must not create duplicate reference records
- multiple seeders can declare dependencies and run in a deterministic order
- seeders can share already-created objects through an in-memory cache during a single run
- the implementation includes pytest coverage for ordering, idempotency, and startup integration

## Existing Integration Points

This feature should align with the current backend structure:

- `app/services/database_service.py` already provides the shared SQLAlchemy `AsyncSession` and startup database initialization
- `main.py` already owns FastAPI lifespan wiring and is the correct place to trigger startup seeding
- `app/modules/user/user_model.py` shows the current SQLAlchemy model style
- `app/config.py` already exposes environment-aware startup helpers and is the correct place for any seeding toggle or helper

The implementation should stay focused on generic seeding infrastructure and avoid unrelated refactors.

## Non-Goals

- replacing Alembic migrations or schema setup
- truncating tables before seeding
- generating large volumes of random demo data
- running seeding automatically in staging or production
- introducing a separate generic repository abstraction for all database access

## Module Shape

Create a dedicated bounded context under `app/modules/seeder/`.

Suggested file layout:

- `app/modules/seeder/base.py`
- `app/modules/seeder/service.py`
- `app/modules/seeder/runner.py`
- `app/modules/seeder/registry.py`
- `tests/modules/seeder/test_runner.py`
- `tests/modules/seeder/test_service.py`
- `tests/modules/seeder/test_startup_integration.py`

The exact file split may vary slightly, but the responsibilities below must remain clear.

## Public Contracts

### `SeedContext`

`SeedContext` is the object passed to each seeder during execution.

It should expose:

- `session: AsyncSession`
- `service: SeedService`
- `cache: dict[str, dict[Any, Any]]`

Recommended shape:

```python
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(slots=True)
class SeedContext:
    session: AsyncSession
    service: "SeedService"
    cache: dict[str, dict[Any, Any]] = field(default_factory=dict)
```

The cache is per-run only. It must not persist outside the current startup execution.

### `BaseSeeder`

Each seeder must implement a small contract with a unique name and optional dependencies.

Recommended shape:

```python
from abc import ABC, abstractmethod
from collections.abc import Sequence


class BaseSeeder(ABC):
    name: str
    depends_on: Sequence[str] = ()

    @abstractmethod
    async def seed(self, ctx: SeedContext) -> None:
        pass
```

Required rules:

- `name` must be unique across all registered seeders
- `depends_on` must reference other seeder names
- `depends_on` must use an immutable default rather than a mutable class-level list
- `seed()` must be idempotent so startup reruns are safe

## `SeedService`

`SeedService` should provide small generic helpers that keep repetitive seeding logic out of concrete seeders.

Minimum required responsibilities:

- read a row by unique lookup fields
- create a row when it does not already exist
- upsert rows by a declared unique field or unique lookup
- flush created or updated models so later seeders can depend on them in the same transaction

Suggested API:

```python
from typing import Any


class SeedService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_or_create(
        self,
        model: type[DeclarativeMeta],
        lookup: dict[str, Any],
        defaults: dict[str, Any] | None = None,
    ) -> Any:
        ...

    async def upsert_by_unique(
        self,
        model: type[DeclarativeMeta],
        unique_field: str,
        rows: list[dict[str, Any]],
        update_fields: list[str] | None = None,
    ) -> None:
        ...
```

Behavior requirements:

- `get_or_create()` must return the existing row when the lookup already matches a persisted record
- `get_or_create()` must create and flush a new row when no record exists
- `upsert_by_unique()` must update only fields explicitly listed in `update_fields`
- `upsert_by_unique()` must insert missing rows and update matching rows in place
- helper methods must stay simple and ORM-focused; they do not need to become a full generic repository layer

## Runner And Ordering

Introduce a `SeederRunner` that accepts a collection of seeders and executes them in dependency order.

Required behavior:

- build a deterministic topological order from `depends_on`
- fail fast when a dependency name is missing
- fail fast when a dependency cycle is detected
- execute each seeder once per run
- create one shared `SeedContext` for the full run

The runner must use explicit cycle detection rather than silently recursing forever.

## Transaction And Error Semantics

Seeding should behave like a startup bootstrap step, not a best-effort background job.

Required behavior:

- all seeders for one startup run must share a single `AsyncSession`
- if any seeder fails, the transaction must be rolled back
- startup seeding failure must fail application startup loudly rather than continue in a partially seeded state
- commit only after all seeders have completed successfully

This keeps local and dev environments predictable.

## Registration

Define an explicit registry function or constant that lists the seeders enabled for startup.

Example:

```python
from app.modules.seeder.base import BaseSeeder


def get_seeders() -> list[BaseSeeder]:
    return [
        # UserSeeder(),
    ]
```

Avoid auto-discovery through filesystem scanning in this iteration. An explicit registry is easier to test and reason about.

## Startup Integration

The runner must be wired into the existing FastAPI lifespan flow in `main.py`.

Expected order:

1. create database tables when startup rules allow it
2. run seeders when seeding is enabled for the current environment
3. start serving requests

Recommended integration shape:

```python
@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None]:
    await create_db_and_tables()
    await seed_reference_data()
    yield
    await redis_service.aclose()
```

## Environment Rules

This system is for development reference data.

Required behavior:

- automatic seeding must run only in `local` and `dev` by default
- automatic seeding must not run in `staging` or `prod`

Recommended configuration addition in `app/config.py`:

- add a helper such as `should_seed_db_on_startup()`
- if a boolean flag is introduced, keep the default safe for local development and disabled outside `local` and `dev`

One acceptable shape is:

```python
def should_seed_db_on_startup(self) -> bool:
    return self.is_local() or self.is_dev()
```

If you introduce an explicit setting such as `SEED_ON_STARTUP`, document it and cover it with tests.

## Idempotency Rules

Because seeds run at startup, every seeder must be safe to execute multiple times.

Required behavior:

- rerunning startup must not create duplicate reference records
- rerunning startup may update existing seeded rows when the seeder explicitly declares update fields
- seeders must identify existing records by stable business keys or unique columns, not by transient primary keys

For example, a user-related seeder should match on a stable field such as `externalId` rather than a generated UUID primary key.

## Cache Usage

The per-run cache exists to avoid repeated lookups and to share already-created objects across dependent seeders.

Required behavior:

- cache keys must be scoped by seeder or model name to avoid collisions
- cache values may store ORM instances or stable identifiers for objects created earlier in the same run
- cache usage must remain an optimization, not the source of truth

Seeders must still work correctly when the cache is initially empty.

## Example Seeder

Concrete seeders should stay small and focused on one reference-data concern.

Example:

```python
class UserSeeder(BaseSeeder):
    name = "users"

    async def seed(self, ctx: SeedContext) -> None:
        user = await ctx.service.get_or_create(
            User,
            lookup={"externalId": "seed-admin"},
        )
        ctx.cache.setdefault("users", {})[user.externalId] = user
```

## Testing Requirements

Add pytest coverage under `tests/modules/seeder/`.

Tests must cover at least:

- topological ordering respects declared dependencies
- missing dependency names raise a clear error
- dependency cycles raise a clear error
- `get_or_create()` returns an existing record instead of creating duplicates
- `get_or_create()` creates and flushes a missing record
- `upsert_by_unique()` inserts missing rows
- `upsert_by_unique()` updates only allowed fields on existing rows
- running the same seeder set twice is idempotent
- startup wiring runs seeding in `local` and `dev`
- startup wiring skips seeding in `staging` and `prod`
- a failing seeder triggers rollback and prevents partial commits

Tests should follow the current async pytest style already used in the repository.

## Implementation Notes

- prefer SQLAlchemy 2 async patterns already used in the codebase
- keep the helper API minimal; add only the abstractions required by real seeders
- keep startup wiring explicit in `main.py`
- keep concrete seeders out of the generic seeder infrastructure package when possible; the infrastructure should support module-owned seeders cleanly

Standalone implementation plan:

- `docs/plans/seeds.plan.md`
