---
name: kanai-api
description: Use when editing Kanai API models, database schema, Alembic migrations, or backend verification workflows.
---

# Kanai API

Use this skill for backend work under `api/`, especially database model or schema changes.

## Migration Policy

- Do not create new Alembic migration files for schema changes unless the user explicitly asks to resume migration creation.
- Current project policy is that `create_db_and_tables` in `api/app/services/database_service.py` handles database schema creation automatically in startup-enabled environments.
- Alembic still exists under `api/alembic/`, but migration generation is on hold by user request.
- If a schema change seems to require a persisted migration, ask before adding a revision file.

## Verification

- Run backend commands from `api/`.
- Prefer `just typecheck` and `just tests` for normal verification.
- Use `uv run pytest <path> -q -n 0` for targeted debugging so xdist does not add noise.
- Treat `just check-all` as non-read-only because it ends with `just fix-all` and can rewrite files.
