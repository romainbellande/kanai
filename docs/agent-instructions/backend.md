# Backend Guidelines

## Overview

These repository-level backend notes apply to `api/`, but `api/AGENTS.md` is the authoritative guide for backend work and overrides this file.

## Commands

- Install runtime and dev dependencies: `uv sync --group dev`
- Show available Just recipes: `just --list`
- Start dev server: `just dev`
- Direct dev server command: `uv run fastapi dev`
- Lint with autofix: `just fix-all`
- Direct Ruff lint fix: `uv run ruff check . --fix`
- Format with Ruff: `uv run ruff format .`
- Type check: `just typecheck`
- Direct type check: `uvx ty check`
- Run full backend tests: `just tests`
- Direct backend tests: `uv run pytest -n auto -qq --show-capture=no --color=no`
- Coverage run from Justfile: `just tests-cov`
- `just tests-cov` currently uses `--cov=src`, but the code lives under `app/`; prefer `uv run pytest -n auto --cov=app` until that recipe is corrected.
- Treat `just check-all` as a full verification pass, but note that it ends with `just fix-all` and can rewrite files.

## Python Conventions

- Use 4-space indentation.
- Let Ruff format code instead of manual alignment.
- Use double quotes unless a library or generated file requires something else.
- Group imports as standard library, third-party, then local application imports.
- Prefer absolute imports rooted at `app` rather than deep relative imports.
- Add explicit type annotations to new public functions, helpers, services, and dependency providers.
- Prefer `X | None` over `Optional[X]` in new code.
- Prefer concrete types over `Any`.

## Naming And Architecture

- Modules, functions, and variables use `snake_case`.
- Classes and Pydantic models use `PascalCase`.
- Constants use `UPPER_SNAKE_CASE`.
- Router instances should follow the `<feature>_router` pattern.
- Keep route definitions inside feature modules under `api/app/modules/`.
- Mount routers centrally from `api/main.py`.
- Reuse the shared async database/session patterns instead of creating ad hoc connections in handlers.

## Error Handling

- Raise `HTTPException` for expected client-facing API errors.
- Do not leak secrets, stack traces, or raw driver errors in responses.
- Prefer narrow exception handling over broad `except Exception` blocks.
- Let unexpected errors surface to framework-level handling unless you have a clear recovery path.
- Keep logs informative enough for debugging without exposing sensitive data.
