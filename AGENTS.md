# Kanai Agent Guide

This repository has two active workspaces: `client/` and `api/`.

## Scope And Precedence

- Follow the most specific instructions available for the directory you edit.
- `api/AGENTS.md` overrides this file for backend work.
- Run frontend commands inside `client/` and backend commands inside `api/`.
- Do not assume repo-root scripts exist.
- Prefer per-command working directories over `cd` chains when tooling supports them.

## Quick Reference

- Frontend: React 19, Vite 7, TanStack Router, TypeScript, Vitest, Tailwind CSS v4, Biome.
- Backend: FastAPI, `uv`, Ruff, Pyrefly, Pytest, SQLAlchemy asyncio, Alembic, Pydantic Settings.
- Infra: `compose.yml` defines a local Keycloak service.

## Commands

- Frontend install: `bun install`
- Frontend dev: `bun --bun run dev`
- Frontend verification: `bun --bun run check` and `bun --bun run test`
- Backend install: `uv sync --group dev`
- Backend dev: `just dev`
- Backend verification: `just typecheck` and `just tests`
- Keycloak: `docker compose up keycloak`

## Detailed Instructions

- [Frontend Guidelines](docs/agent-instructions/frontend.md)
- [Backend Guidelines](docs/agent-instructions/backend.md)
- [Testing Guidelines](docs/agent-instructions/testing.md)
- [Workflow Notes](docs/agent-instructions/workflow.md)
