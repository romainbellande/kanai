# SQLModel Migration Spec

## Goal

Migrate the API's relational persistence layer from direct SQLAlchemy declarative models to SQLModel.

The outcome is a simpler model-definition approach that preserves the current async FastAPI runtime, current database schema behavior, and current startup and seeding flows.

## Problem

The API currently defines relational models with raw SQLAlchemy declarative mappings while using Pydantic models separately elsewhere in the codebase.

That split adds boilerplate around model fields, metadata, and typing, and it makes the relational layer less consistent with the rest of the project's validation and model style. The migration needs to simplify model definitions without changing runtime behavior, schema semantics, or startup safety.

## Scope

This spec covers:

- replacing current SQLAlchemy declarative table models with SQLModel table models
- preserving async database access, startup table creation, and seeding behavior after the migration
- updating Alembic metadata wiring and test fixtures so they work with SQLModel-backed models

This spec does not cover:

- rewriting Redis, auth, or other non-relational modules that do not depend on the SQLAlchemy ORM model base
- redesigning the user domain, adding new API endpoints, or changing existing product behavior

## Existing Context

List relevant product or codebase facts that the behavior must align with.

- `api/app/services/database_service.py` currently owns the shared async engine, async session factory, `get_db()`, and local/dev startup table creation
- `api/app/modules/user/user_model.py` is the current relational model and defines the `users` table with a UUID primary key, `externalId`, `created_at`, and `updated_at`
- `api/app/modules/seeder/` and its tests rely on `AsyncSession`, `select(...)`, and metadata-driven table creation to support idempotent startup seeding
- `api/alembic/env.py` currently points Alembic autogeneration at model metadata and reads the database URL from app settings

## Required Behavior

The finished feature must provide:

- SQLModel must become the primary API for defining application table models while preserving the existing table names, column names, nullability, and default/update semantics
- the shared database service must continue to expose async engine and async session behavior compatible with FastAPI dependencies, seeders, and tests
- startup table creation and Alembic autogeneration must use SQLModel metadata so existing local/dev bootstrap and migration workflows continue to work
- code that creates, queries, updates, and seeds relational data must continue to work against migrated models without changing current product behavior

## User Or System Flow

Describe the expected behavior in sequence.

1. The application or test environment initializes the shared async database engine and session factory.
2. Relational models are registered in a single SQLModel metadata source used by startup bootstrap and migration tooling.
3. In `local` and `dev`, startup table creation creates the same tables as before and seeding runs against SQLModel-backed models.
4. Runtime code and test fixtures create, load, and update model instances through async sessions without changing current transaction boundaries.
5. Alembic compares database state against the SQLModel metadata and does not introduce unintended schema drift for unchanged tables.

## Rules And Constraints

Define invariants, policy rules, and behavioral constraints.

- the migration must preserve the current async I/O model and must not switch the API to synchronous database sessions
- the `users` table must remain schema-compatible, including UUID primary key behavior, `externalId`, and timezone-aware timestamp fields with the same required/default semantics
- there must be one authoritative metadata source for relational models after the migration
- the migration must stay focused on the persistence layer and must not introduce unrelated architecture or feature refactors

## Data Expectations

Describe the data shape or data guarantees at the product or domain level.

Required data:

- a SQLModel-backed `User` table model representing `users`
- persisted user records with `id`, `externalId`, `created_at`, and `updated_at`

Optional data:

- additional non-table SQLModel or Pydantic model variants if needed for clean separation of persistence and API payloads
- explicit SQLAlchemy column configuration inside SQLModel fields where needed to preserve current timestamp or type behavior

Validation or consistency rules:

- required persisted fields must remain required when creating relational records
- migrated model definitions must preserve current database-level defaults and update behavior for timestamps
- metadata used by startup bootstrap and Alembic must include all migrated relational models consistently

## Error Cases

Describe expected failure modes and required outcomes.

- when the SQLModel migration changes field configuration in a way that would alter schema unexpectedly, the system must surface that drift during migration review or verification and block acceptance
- when startup table creation cannot initialize the database from SQLModel metadata, the system must fail startup loudly instead of continuing in a partially initialized state
- when Alembic cannot discover the migrated model metadata, the system must treat migration autogeneration as broken and require correction before acceptance

## Environment Or Runtime Rules

Document any environment-specific behavior if relevant.

- in `local` and `dev`, automatic table creation must continue to create all registered SQLModel tables before seeders run
- in `staging` and `prod`, the existing startup safety rules remain unchanged; this migration must not broaden automatic schema creation or seeding behavior

## Observability Or Audit Requirements

Document any required logging, metrics, traceability, or audit expectations.

- database initialization failures after the migration must continue to emit clear error logs through the existing startup logging path
- verification of the migration must make unintended schema diffs visible, especially around Alembic metadata wiring and seed-related startup behavior

## Security And Privacy

Document any security, authorization, privacy, or data-handling rules.

- the migration must not expose additional database fields or internal ORM state in API responses or logs
- database URLs and other environment-provided secrets must remain configuration-driven and must not be embedded in model definitions or migration logic

## Acceptance Criteria

This spec is satisfied only if all of the following are true:

- application table models use SQLModel definitions instead of the current `DeclarativeBase` plus `Mapped` and `mapped_column` pattern
- the shared database service, local/dev startup bootstrap, and seeder flows still operate with async sessions after the migration
- the `users` table remains behaviorally equivalent for existing data and workflows, with no unintended schema changes
- Alembic metadata configuration targets the migrated SQLModel metadata and can support autogeneration without missing models or generating spurious schema changes
- tests covering database bootstrap, seeding, and model persistence are updated to reflect the migration and still pass

## Testing Expectations

Describe what behaviors must be verified, without prescribing test file structure or implementation approach.

- verify that startup database creation still works in allowed environments using SQLModel metadata
- verify that seeding helpers and transaction rollback behavior still work with migrated models under async sessions
- verify that the migrated `User` model preserves required field behavior, UUID primary key handling, and timestamp behavior
- verify that Alembic metadata discovery remains aligned with the migrated models and does not miss the application's relational tables

## Notes

- keep this document focused on expected behavior, not implementation structure
- move execution details, file plans, and sequencing into a corresponding plan document under `docs/plans/`
