# SQLModel Migration Light Implementation Plan

## Objective

Implement `the API persistence-layer migration from SQLAlchemy declarative models to SQLModel while preserving current async runtime, schema behavior, startup table creation, and seeding flows`.

This plan is intended for a smaller autonomous task.

The agent should be able to execute from this plan alone. Reading related spec files is optional for extra context, not required to proceed.

## Source Of Truth

Primary specification or issue:

- `docs/specs/sqlmodel_migration_1776588325.spec.md`

Codebase integration points:

- `api/app/services/database_service.py`
- `api/app/modules/user/user_model.py`
- `api/alembic/env.py`
- `api/app/modules/seeder/service.py`
- `api/app/modules/seeder/startup.py`
- `api/tests/modules/seeder/`

If the implementation encounters a minor ambiguity, prefer the smallest change that preserves this plan and existing repo patterns.

If this plan and a related spec differ in emphasis, follow this plan for implementation decisions because it is the execution-oriented handoff.

## Required Outcome

The finished implementation must provide:

- SQLModel-backed table models for the API, with `User` remaining schema-compatible with the current `users` table
- one authoritative metadata source used consistently by startup table creation, Alembic autogeneration, and test table setup
- unchanged async engine and `AsyncSession` behavior for FastAPI dependencies, seeders, and tests

## Constraints

- do not change product behavior, API shape, or non-relational modules such as auth or Redis
- do not switch database access to synchronous sessions or introduce a repository-layer refactor
- keep changes local to `api/app/services/`, `api/app/modules/user/`, Alembic metadata wiring, and the affected tests

## Exact Files To Touch

The agent should expect to edit these existing files:

- `api/pyproject.toml`
- `api/app/services/database_service.py`
- `api/app/modules/user/user_model.py`
- `api/alembic/env.py`
- `api/tests/modules/seeder/test_runner.py`
- `api/tests/modules/seeder/test_service.py`

The agent should expect to create these new files:

- `api/tests/services/test_database_service.py`
- `api/tests/modules/user/test_user_model.py`

Avoid touching unrelated files unless a minimal adjustment is required to complete the task correctly.

## Implementation Defaults

If the agent must make a choice without asking for clarification, use these defaults:

- prefer `SQLModel.metadata` as the single metadata source instead of adding a new metadata abstraction
- prefer explicit field configuration or `sa_column` wiring only where needed to preserve current UUID and timestamp semantics
- avoid adding extra SQLModel variants unless the migration needs one for a clean persistence boundary

## Implementation Steps

1. Update `api/pyproject.toml` and `api/app/services/database_service.py` to add SQLModel support while preserving the current async engine, session factory, `get_db()`, and startup guards.
2. Rewrite `api/app/modules/user/user_model.py` as a SQLModel table model that keeps the `users` table name, `externalId`, UUID primary key behavior, and `created_at` / `updated_at` timestamp semantics unchanged.
3. Update `api/alembic/env.py` so Alembic targets SQLModel metadata, and make sure model registration is explicit enough that startup `create_all()` and autogeneration see the same tables.
4. Update seeder tests and add focused tests for database bootstrap metadata and SQLModel-backed `User` persistence behavior.
5. Run verification commands.

## Tests

Minimum required coverage:

- startup table creation uses SQLModel metadata and still creates the migrated tables in allowed environments
- seeder service and runner still create, query, flush, and roll back `User` rows correctly under async sessions
- the migrated `User` model preserves required field behavior, UUID primary key generation, and timestamp defaults / update wiring

Testing guidance:

- follow the repo's existing async pytest style
- keep tests focused on behavioral equivalence, not SQLModel internals
- avoid brittle assertions on generated SQL when metadata or persisted behavior can be asserted directly

## Verification

Run these commands after the code changes:

- `just --justfile api/Justfile tests`
- `just --justfile api/Justfile typecheck`
- `just --justfile api/Justfile fix-all`

If one verification command fails:

- fix the failure if it is caused by the feature changes
- if the failure is clearly unrelated pre-existing repo state, document it in the final handoff with enough detail for the user to reproduce

## Acceptance Criteria

The task is complete only if all of the following are true:

- `api/app/modules/user/user_model.py` uses SQLModel instead of `DeclarativeBase`, `Mapped`, and `mapped_column`
- startup bootstrap, Alembic autogeneration, and test table creation all use the migrated SQLModel metadata without missing the `users` table or introducing obvious schema drift
- tests added and passing
- `just --justfile api/Justfile tests`, `just --justfile api/Justfile typecheck`, and `just --justfile api/Justfile fix-all` succeed

## Delivery Format For The Agent

When the implementation is complete, the agent should be able to report:

- which files were created
- which existing files were edited
- what behavior was implemented
- what tests were added
- the result of `just --justfile api/Justfile tests`
- the result of `just --justfile api/Justfile typecheck`
- the result of `just --justfile api/Justfile fix-all`
- any deviations from the plan, if any

## Notes For The Agent

- prefer the smallest correct implementation
- do not stop after scaffolding; carry the work through tests and verification
- do not leave TODO comments as a substitute for implementation
