# Seeds Implementation Plan

## Objective

Implement a generic database seeding system under `app/modules/seeder/` that runs automatically during FastAPI startup, seeds development reference data safely in `local` and `dev`, and is safe to rerun on every app boot.

This plan is intended to be sufficient for an autonomous agent to implement the feature end to end.

The agent should be able to execute from this plan alone. Reading `docs/specs/seeds.spec.md` is optional for extra context, not required to proceed.

## Source Of Truth

Primary specification:

- `docs/specs/seeds.spec.md`

Codebase integration points:

- `app/config.py`
- `app/services/database_service.py`
- `app/modules/user/user_model.py`
- `main.py`
- existing pytest style under `tests/`

If the implementation encounters a minor ambiguity, prefer the smallest change that preserves this plan and existing repo patterns.

If this plan and the spec differ in emphasis, follow this plan for implementation decisions because it is the execution-oriented handoff.

## Required Outcome

The finished implementation must provide:

- a reusable seeder contract and runner under `app/modules/seeder/`
- deterministic dependency ordering between seeders
- explicit failure on missing dependencies and dependency cycles
- one shared SQLAlchemy `AsyncSession` for a full seeding run
- rollback on any seeder failure
- startup failure if seeding fails
- environment guards so automatic seeding runs only in `local` and `dev`
- idempotent reruns that do not create duplicate reference records
- automated tests covering runner behavior, service behavior, idempotency, and startup integration

## Constraints

- do not add production seeding behavior
- do not add table truncation or destructive reset behavior
- do not add filesystem-based seeder auto-discovery
- do not introduce a large generic repository abstraction
- keep the changes local to the seeding concern and startup wiring
- follow existing async SQLAlchemy and pytest patterns in the repo

## Known Repo Assumptions

These assumptions are already true in the current repo and should be relied on unless the codebase changes during implementation:

- `main.py` owns FastAPI lifespan startup and shutdown orchestration
- `app/services/database_service.py` exports `DBSession`, `Base`, and `create_db_and_tables()`
- `app/config.py` already exposes environment helpers and is the right home for a seeding startup helper
- `app/modules/user/user_model.py` defines `User` with `externalId` and generated UUID primary keys
- the repo uses async SQLAlchemy 2 patterns
- the repo uses pytest with async tests and environment defaults from `tests/conftest.py`
- `just tests`, `just typecheck`, and `just fix-all` are the standard verification commands

Important implementation assumption:

- for this iteration, do not introduce Alembic migrations or unrelated schema changes just to support the seed system
- the first concrete seeder should use `User.externalId` as its stable lookup key through `get_or_create()`
- if a database-level uniqueness constraint on `externalId` would require broader migration work, skip that change in this iteration and keep idempotency at the application seeder level

## Exact Files To Touch

The agent should expect to edit these existing files:

- `app/config.py`
- `main.py`
- `docs/specs/seeds.spec.md` only if a tiny clarification is needed after implementation; otherwise leave it unchanged

The agent should expect to create these new files:

- `app/modules/seeder/base.py`
- `app/modules/seeder/service.py`
- `app/modules/seeder/runner.py`
- `app/modules/seeder/registry.py`
- `app/modules/seeder/startup.py`
- `tests/modules/seeder/test_runner.py`
- `tests/modules/seeder/test_service.py`
- `tests/modules/seeder/test_startup_integration.py`

Optional new file:

- `app/modules/user/user_seeder.py` if keeping the concrete user seeder outside the generic seeder package makes the implementation cleaner

Avoid touching unrelated auth or Redis files unless a test import path forces a minimal adjustment.

## Implementation Defaults

If the agent must make a choice without asking for clarification, use these defaults:

- prefer explicit registration over discovery
- prefer one runner class over multiple orchestration helpers
- prefer one transaction for the full startup seeding run
- prefer one per-run in-memory cache object shared across all seeders
- prefer insert-only behavior for `upsert_by_unique()` when `update_fields` is `None`
- prefer small local exception classes only if they improve test clarity
- prefer the existing `User` model for the first real seeder
- prefer the smallest amount of code that satisfies tests and the spec

## Recommended File Layout

Create these files unless there is a strong reason to collapse one of them:

- `app/modules/seeder/base.py`
- `app/modules/seeder/service.py`
- `app/modules/seeder/runner.py`
- `app/modules/seeder/registry.py`
- `app/modules/seeder/startup.py`
- `tests/modules/seeder/test_runner.py`
- `tests/modules/seeder/test_service.py`
- `tests/modules/seeder/test_startup_integration.py`

You may add a small `__init__.py` if useful, but avoid unnecessary package surface area.

## Implementation Steps

### 1. Add config support

Update `app/config.py` to expose startup seeding intent.

Required change:

- add `Settings.should_seed_db_on_startup()`

Required behavior:

- return `True` in `local`
- return `True` in `dev`
- return `False` in `staging`
- return `False` in `prod`

Keep this helper parallel to the existing `should_init_db_on_startup()` pattern.

Do not add a new environment variable unless it is truly necessary. The default implementation should derive behavior from `environment` alone.

### 2. Create base seeder contracts

Create `app/modules/seeder/base.py`.

Implement:

- `SeedContext`
- `BaseSeeder`

`SeedContext` requirements:

- include `session: AsyncSession`
- include `service: SeedService`
- include `cache: dict[str, dict[Any, Any]]`
- cache must be per-run only

`BaseSeeder` requirements:

- `name: str`
- `depends_on: Sequence[str] = ()`
- `async def seed(self, ctx: SeedContext) -> None`

Rules:

- `depends_on` must not use a mutable default list
- concrete seeder names must be unique inside a run
- each concrete `seed()` implementation must be idempotent

Typing guidance:

- use straightforward Python typing that fits the current codebase
- avoid overengineering generics if they make the implementation harder to read

### 3. Create the seeding helper service

Create `app/modules/seeder/service.py`.

Implement a small `SeedService` around `AsyncSession`.

Required methods:

- `get_or_create(model, lookup, defaults=None)`
- `upsert_by_unique(model, unique_field, rows, update_fields=None)`

Required behavior for `get_or_create()`:

- query by `lookup`
- return the existing row if found
- create a row from `lookup + defaults` if not found
- `session.add()` and `await session.flush()` when creating
- return the ORM instance

Required behavior for `upsert_by_unique()`:

- for each input row, locate an existing row using `unique_field`
- create missing rows
- update only fields listed in `update_fields`
- if `update_fields` is `None`, do not mutate existing rows unless that is required by the chosen implementation; prefer the safer minimal behavior of insert-only for existing rows when no update fields are supplied
- `await session.flush()` after processing

Implementation guidance:

- keep this ORM-focused and minimal
- do not turn it into a full repository layer
- use SQLAlchemy 2 async style already used elsewhere in the repo

Decision rule:

- if SQLAlchemy typing for the generic `model` parameter becomes noisy, prefer a simpler precise-enough type over a deeply abstracted one

### 4. Create the runner

Create `app/modules/seeder/runner.py`.

Implement `SeederRunner` that accepts:

- `seeders: list[BaseSeeder]`
- `session: AsyncSession`

Required behavior:

- build a deterministic topological order from `depends_on`
- fail fast when a dependency name is missing
- fail fast when a cycle exists
- execute each seeder exactly once per run
- create one shared `SeedContext` for the full run
- commit only after all seeders succeed
- rollback if any seeder fails, then re-raise
- preserve the original exception as the startup failure cause

Implementation guidance:

- use explicit temporary/permanent marks or equivalent cycle detection
- do not rely on recursion without cycle tracking
- duplicate seeder names should raise a clear error during runner setup

Error guidance:

- if custom exceptions are added, keep them local to the seeder module and name them plainly
- error messages should include the seeder name or dependency name that caused the failure

It is acceptable to define small seeder-specific exception classes if that improves clarity, but keep them local and minimal.

### 5. Create an explicit registry

Create `app/modules/seeder/registry.py`.

Implement:

- `get_seeders() -> list[BaseSeeder]`

Rules:

- this must be explicit, not dynamic discovery
- return the concrete seeders that should run at startup
- keep it easy to test by avoiding hidden import magic

The registry should remain small. Do not build a plugin system.

### 6. Add startup orchestration

Create `app/modules/seeder/startup.py`.

Implement a small orchestration function, for example `seed_reference_data()`.

Required behavior:

- if `settings.should_seed_db_on_startup()` is `False`, return immediately
- otherwise create one `AsyncSession` using the existing session factory from `app/services/database_service.py`
- instantiate `SeederRunner` with `get_seeders()` and the session
- run the runner
- allow errors to propagate so app startup fails loudly
- if `get_seeders()` returns an empty list, treat that as a no-op success

Preferred session source:

- reuse `DBSession` from `app/services/database_service.py`

Preferred structure:

```python
async with DBSession() as session:
    runner = SeederRunner(get_seeders(), session)
    await runner.run()
```

Do not duplicate commit or rollback logic in both `startup.py` and `runner.py`. Keep transaction ownership in one place only. Preferred default: `SeederRunner.run()` owns commit and rollback.

### 7. Add at least one concrete reference-data seeder

Add one real seeder so the system is exercised end to end.

Use the existing `User` model in `app/modules/user/user_model.py`.

Recommended behavior:

- seed a stable development user record using `externalId`
- use a deterministic value such as `seed-admin`
- use `get_or_create()` so reruns do not create duplicates
- keep the seeded payload minimal; do not invent extra user columns or unrelated fixtures

This concrete seeder may live in either:

- `app/modules/seeder/registry.py` for a very small implementation, or
- a dedicated file such as `app/modules/user/user_seeder.py` if that keeps ownership clearer

Prefer the smallest clean structure.

Do not create multiple concrete seeders unless needed to validate dependency behavior in tests. Tests can use fake seeders instead.

### 8. Wire startup seeding into `main.py`

Update `main.py` lifespan flow.

Required order:

1. call `create_db_and_tables()`
2. call the seeding orchestration function
3. yield control to FastAPI
4. on shutdown, continue existing Redis cleanup behavior

Do not move startup wiring out of `main.py`.

Be careful not to break the existing auth middleware wiring and Redis shutdown flow.

### 9. Add tests

Add tests under `tests/modules/seeder/`.

Minimum required coverage:

- runner orders seeders according to dependencies
- runner raises on a missing dependency name
- runner raises on a dependency cycle
- runner raises on duplicate seeder names
- `get_or_create()` returns an existing row instead of creating a duplicate
- `get_or_create()` creates and flushes a missing row
- `upsert_by_unique()` inserts missing rows
- `upsert_by_unique()` updates only the permitted fields on existing rows
- rerunning the same concrete seeder set is idempotent
- startup seeding executes in `local`
- startup seeding executes in `dev`
- startup seeding is skipped in `staging`
- startup seeding is skipped in `prod`
- a seeder failure rolls back the transaction and prevents partial commits

Recommended additional coverage if cheap:

- `get_seeders()` returns concrete seeder instances in explicit order
- startup seeding is a no-op when no seeders are registered
- cache sharing works across dependent fake seeders in one run

Testing guidance:

- follow the repo’s async pytest style
- keep tests focused and local to the seeder module
- prefer small fake seeders for runner tests
- for startup tests, patch the environment/helper and verify whether the startup seeding function is called or skipped
- for transaction tests, verify no partial seeded state remains after a failure
- if testing `main.py` import behavior, follow the existing style in `tests/test_main.py`
- avoid brittle tests that depend on implementation details not required by the spec

Suggested split:

- `test_runner.py`: ordering, duplicate names, missing deps, cycles, cache sharing, rollback behavior with fake seeders
- `test_service.py`: `get_or_create()` and `upsert_by_unique()` behavior using the real session and `User` model
- `test_startup_integration.py`: environment gating and `main.py` or startup function integration

### 10. Verify the implementation

Run these commands after the code changes:

- `just tests`
- `just typecheck`
- `just fix-all`

If formatting changes touch newly edited files, keep them.

If one verification command fails:

- fix the failure if it is caused by the seeding changes
- if the failure is clearly unrelated pre-existing repo state, document it in the final handoff with enough detail for the user to reproduce

## Acceptance Criteria

The task is complete only if all of the following are true:

- seeding infrastructure exists under `app/modules/seeder/`
- startup seeding is wired into `main.py`
- automatic seeding is environment-gated to `local` and `dev`
- rerunning startup does not create duplicate seeded rows
- dependency ordering is deterministic and validated
- failure in one seeder rolls back the run and fails startup
- all required tests were added and are passing
- `just tests`, `just typecheck`, and `just fix-all` succeed

## Delivery Format For The Agent

When the implementation is complete, the agent should be able to report:

- which files were created
- which existing files were edited
- what concrete seeder was added
- how startup gating works
- what tests were added
- the result of `just tests`
- the result of `just typecheck`
- the result of `just fix-all`
- any deviations from the plan, if any

## Notes For The Agent

- prefer the smallest correct implementation
- do not invent extra abstraction layers unless they remove real duplication
- do not add production-only safeguards beyond the environment gate already required
- if a minor naming choice is needed, pick the clearest name and continue
- if an ambiguity remains after consulting the spec and this plan, choose the behavior that is safest for startup reruns and easiest to test
- do not stop after scaffolding; carry the work through tests and verification
- do not leave TODO comments as a substitute for implementation
