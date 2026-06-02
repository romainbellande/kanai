---
name: kanai-api
description: Use when editing Kanai API backend code under api/, especially app/core, app/api, app/db, app/models, app/schemas, app/repositories, app/services, Alembic migrations, or backend verification workflows.
---

# Kanai API

Use this skill for backend work under `api/`, especially API routes, database model or schema changes, repositories, services, authentication, startup behavior, Alembic, or backend verification.

## Architecture Map

- `api/app/main.py` defines the FastAPI app, middleware, lifespan, and mounts the versioned API router.
- `api/app/core/` contains configuration, security/auth middleware, logging, and shared exceptions.
- `api/app/api/deps.py` contains shared FastAPI dependencies and access guards.
- `api/app/api/v1/router.py` composes versioned routers.
- `api/app/api/v1/endpoints/` contains route handlers.
- `api/app/models/` contains SQLModel database models.
- `api/app/schemas/` contains Pydantic request/response schemas and auth session payloads.
- `api/app/repositories/` contains persistence adapters and repository protocols.
- `api/app/services/` contains application services and business workflows.
- `api/app/db/session.py` owns the async engine, session factory, DB dependency, and startup table creation.
- `api/app/db/base.py` imports models for SQLModel metadata registration.
- `api/app/db/migrations/` contains Alembic environment files and revisions.
- `api/app/integrations/` contains external service clients/providers.
- `api/app/utils/` contains shared utility helpers.

## Migration Policy

- Do not create new Alembic migration files for schema changes unless the user explicitly asks to resume migration creation.
- Current project policy is that `create_db_and_tables` in `api/app/db/session.py` handles database schema creation automatically in startup-enabled environments.
- Model metadata registration lives in `api/app/db/base.py`.
- Alembic exists under `api/app/db/migrations/`, but migration generation is on hold by user request.
- If a schema change seems to require a persisted migration, ask before adding a revision file.

## Database Gotchas

- Do not read `.env` or other secret-bearing files unless the user explicitly authorizes it.
- Avoid string-based SQLAlchemy ordering such as `order_by("rank")`; it can resolve to PostgreSQL ordered-set aggregate functions. Use explicit model attributes such as `Task.rank`.
- If startup schema creation or repair handles new columns, make sure repair runs before any early "already initialized" skip.

## Skill Maintenance Trigger

- After backend architecture, command, migration, or verification workflow changes, check whether this skill still matches the repository.
- Compare changes against `api/AGENTS.md`, `api/Justfile`, `api/alembic.ini`, `api/app/**`, `api/app/db/**`, and backend verification commands.
- If any referenced path, command, or workflow changes, update this skill in the same task or explicitly tell the user that the skill may now be stale.

## Verification

- Run backend commands from `api/`.
- Prefer `just typecheck` and `just tests` for normal verification.
- Use `uv run pytest <path> -q -n 0` for targeted debugging so xdist does not add noise.
- Treat `just check-all` as non-read-only because it ends with `just fix-all` and can rewrite files.
