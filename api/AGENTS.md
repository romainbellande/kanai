# AGENTS.md

This file is for coding agents working in `/home/naimor/dev/kanai/api`.

## Project Snapshot

- Language: Python 3.13 (`.python-version`)
- Runtime/dependency manager: `uv`
- Web framework: FastAPI
- Config: Pydantic Settings
- Database layer: SQLAlchemy asyncio
- Migrations: Alembic
- Lint/format: Ruff
- Type checking: ty
- Tests: Pytest with `pytest-asyncio`, `pytest-xdist`, `pytest-cov`, `pytest-httpx`, `pytest-env`

## Repository Layout

- `app/main.py` defines the FastAPI app and mounts the versioned API router.
- `app/core/config.py` holds environment-backed settings.
- `app/db/session.py` creates the async engine and DB session dependency.
- `app/api/v1/endpoints/` contains route handlers; `app/api/deps.py` contains shared FastAPI dependencies.
- `app/models/`, `app/schemas/`, `app/repositories/`, and `app/services/` hold persistence models, API contracts, persistence adapters, and business logic.
- `app/db/migrations/` contains Alembic migration environment files and revisions.
- `Justfile` is the main command entrypoint for local workflows.
- `pyproject.toml` currently defines dependencies only; there is no tool-specific config block yet.

## Setup Commands

- Install runtime + dev dependencies: `uv sync --group dev`
- Start the dev server: `just dev`
- Direct dev server command: `uv run fastapi dev app/main.py`
- Show available Just commands: `just --list`

## Build / Lint / Test Commands

- There is no dedicated package build command or Docker workflow in this repo yet.
- Treat `just check-all` as the closest thing to a full local verification pass.
- Important: `just check-all` is not read-only; it ends with `just fix-all` and may rewrite files.

- Lint with autofix: `just fix-all`
- Direct lint fix command: `uv run ruff check . --fix`
- Direct formatter command: `uv run ruff format .`
- Lint only, no writes: `uv run ruff check .`
- Format only: `uv run ruff format .`
- Type check: `just typecheck`
- Direct type check: `uvx ty check`

- Full test suite: `just tests`
- Direct full test command: `uv run pytest -n auto -qq --show-capture=no --color=no`
- Coverage recipe in `Justfile`: `just tests-cov`
- Coverage uses `uv run pytest -n auto --cov=app`.

## Running A Single Test

- Single test file: `uv run pytest tests/test_example.py -q -n 0`
- Single test function: `uv run pytest tests/test_example.py::test_case_name -q -n 0`
- Match by expression: `uv run pytest -k "user and not slow" -q -n 0`
- Re-run last failure: `uv run pytest --lf -q -n 0`
- Show local prints while debugging: `uv run pytest tests/test_example.py::test_case_name -s -vv -n 0`
- Use `-n 0` for targeted runs so xdist does not add noise while debugging.

## Current Testing State

- No `tests/` directory exists yet.
- No `pytest.ini`, `tox.ini`, or `conftest.py` exists yet.
- Pytest behavior is currently defined by direct command flags in `Justfile`.
- If you add tests, create a `tests/` package at the repo root unless a clearer layout emerges.

## Code Style Baseline

- Use 4-space indentation.
- Use Ruff formatting instead of manual alignment tweaks.
- Use double quotes unless a library or generated file requires otherwise.
- Keep functions and modules small and feature-focused.
- Let Ruff handle wrapping; there is no custom formatter config in the repo today.

## Imports

- Group imports in this order: standard library, third-party, local application.
- Separate import groups with a single blank line.
- Prefer absolute imports rooted at `app`, not deep relative imports.
- Import only what the module uses.
- Keep one logical import per line when it improves readability.
- If an import becomes unused after edits, remove it in the same change.

## Types

- Add explicit type annotations to new public functions, helpers, and dependency providers.
- Add return types on route handlers and service functions where practical.
- Prefer concrete types over `Any`.
- Use `X | None` syntax instead of `Optional[X]` in new code.
- Keep request/response boundaries typed with Pydantic models once schemas are introduced.
- Make async database dependencies and service entrypoints obviously typed.
- `ty` is part of the default workflow, so leave code type-check friendly.

## Naming Conventions

- Modules, functions, variables: `snake_case`
- Classes, Pydantic models, settings classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Router instances: `<feature>_router`
- Keep feature names singular or plural based on route semantics, but be consistent inside the feature.

## FastAPI Conventions

- Keep route definitions inside endpoint modules under `app/api/v1/endpoints/`.
- Mount routers centrally from `app/main.py` through `app/api/v1/router.py`.
- Use `async def` for request handlers unless there is a clear sync-only reason.
- Return JSON-serializable data or response models, not raw ORM objects.
- Use dependency injection for DB sessions and request-scoped resources.
- Keep router setup, schemas, services, and persistence concerns separated as the codebase grows.

## Database Conventions

- This repo uses SQLAlchemy async APIs; keep new DB access async.
- Reuse the shared engine/session pattern from `app/db/session.py`.
- Expose DB sessions through FastAPI dependencies rather than creating ad hoc sessions in handlers.
- Close or dispose resources correctly in `finally` blocks or lifespan hooks.
- Avoid mixing sync and async SQLAlchemy patterns in the same path.

## Configuration Conventions

- Centralize environment-backed settings in `app/core/config.py`.
- Local development reads from `.env` through Pydantic Settings.
- Required settings should fail fast during startup rather than silently defaulting.
- The settings model enables nested env keys with `__`; keep that convention if nested settings are added.
- Use uppercase environment variable names such as `DATABASE_URL`.

## Error Handling

- Raise `HTTPException` for expected client-facing API errors.
- Do not leak stack traces, secrets, or raw driver errors in HTTP responses.
- Let unexpected errors surface to FastAPI's error handling unless there is a clear recovery path.
- Prefer narrow exception handling over broad `except Exception` blocks.
- Include enough context in logs or error messages for debugging, but keep responses safe.

## Testing Expectations For New Code

- Add tests with each behavior change when the repo has enough surface area to support them.
- Prefer endpoint-level tests for routers and focused unit tests for pure helpers.
- Use `pytest-asyncio` for async test functions.
- Use `pytest-httpx` when external HTTP calls are introduced.
- Keep tests deterministic; avoid hidden network or environment dependencies.
- For database tests, isolate state per test and avoid cross-test leakage.

## Known Gaps / Observations

- No dedicated lint, pytest, or Ruff config file exists beyond the command usage above.

## Agent Working Rules

- Read `Justfile` before assuming the canonical command for a task.
- Prefer `just` recipes first, then fall back to `uv run ...` for narrower commands.
- Prefer minimal, local changes over broad refactors.
- Do not move code into a new top-level package without a clear repository-wide reason.
- Keep new files under `app/` or `tests/` unless the task calls for new infrastructure.
- If you change commands, tooling, or layout, update `AGENTS.md` in the same task.
