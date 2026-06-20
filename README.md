# Kanai

Kanai is a project management application built around Projects, Sprints, Tasks, and a Backlog, with an AI-assisted **Task Shaping Chat** that interviews a member to refine a task before it is saved. See [`CONTEXT.md`](CONTEXT.md) for the full domain vocabulary.

## Stack

- **Frontend** (`client/`): React 19, Vite 7, TanStack Router, TanStack Query, TypeScript, Tailwind CSS v4, Base UI, Biome. OpenAPI-generated API client.
- **Backend** (`api/`): FastAPI, `uv`, SQLAlchemy (asyncio), SQLModel, Alembic, Pydantic Settings, Pydantic-AI, A2A SDK, Redis, joserfc (OIDC).
- **Infra** (`compose.yml`): Keycloak (auth, `:7080`), PostgreSQL 18, Redis 8, RedisInsight (`:5540`).

## Getting Started

Prerequisites: `bun`, `uv`, `just`, Docker.

```bash
# Infrastructure (Keycloak, Postgres, Redis)
docker compose up -d

# Install deps
cd client && bun install && cd ..
cd api && uv sync --group dev && cd ..

# Run both apps (client :3000, api :8000)
just dev
```

Frontend and backend can be run independently with `just dev-client` and `just dev-api`.

## Commands

| Task | Command |
|------|---------|
| Quality gate | `just pre-commit` |
| Frontend checks | `bun --bun run check` |
| Frontend tests | `bun --bun run test` |
| Backend typecheck | `just typecheck` |
| Backend tests | `just tests` |
| Regenerate OpenAPI client | `just gen-openapi-client` |

Commands run from the repo root unless noted. Frontend commands run inside `client/`, backend commands inside `api/`.

## Project Layout

```
client/   # React frontend (TanStack Router file-based routes in src/routes/)
api/      # FastAPI backend (app/{api,features,models,services,repositories,schemas})
compose.yml  # Keycloak, Postgres, Redis, RedisInsight
CONTEXT.md   # Domain vocabulary (Project, Sprint, Task, Backlog, Task Shaping Chat)
```

## Compound Engineering Workflow

> The section below documents the agent workflow this repo uses for feature work.

`/ce-strategy` is upstream of the loop -- it captures the product's target problem, approach, persona, metrics, and tracks as a short durable anchor at `STRATEGY.md`. Ideate, brainstorm, and plan read it as grounding when present, so strategy choices flow into feature conception, prioritization, and spec.

The core loop is: brainstorm the requirements, plan the implementation, work through the plan, review the result, compound the learning, then repeat with better context.

Use `/ce-ideate` before the loop when you want the agent to generate and critique bigger ideas before choosing one to brainstorm. It produces a ranked ideation artifact, not requirements, plans, or code.

| Skill | Purpose |
|-------|---------|
| `/ce-strategy` | Create or maintain `STRATEGY.md` -- the product's target problem, approach, persona, key metrics, and tracks. Read as grounding by ideate, brainstorm, and plan |
| `/ce-ideate` | Optional big-picture ideation: generate and critically evaluate grounded ideas, then route the strongest one into brainstorming |
| `/ce-brainstorm` | Interactive Q&A to think through a feature or problem and write a right-sized requirements doc before planning |
| `/ce-plan` | Turn feature ideas into detailed implementation plans |
| `/ce-work` | Execute plans with worktrees and task tracking |
| `/ce-debug` | Systematically reproduce failures, trace root cause, and implement fixes |
| `/ce-code-review` | Multi-agent code review before merging |
| `/ce-compound` | Document learnings to make future work easier |
| `/ce-product-pulse` | Generate a single-page, time-windowed pulse report on usage, performance, errors, and followups. Saves to `docs/pulse-reports/` |

`/ce-product-pulse` is the read-side companion -- a time-windowed report on what users actually experienced and how the product performed over a given window (24h, 7d, etc.), saved to `docs/pulse-reports/` so past pulses form a browseable timeline of user outcomes. The next strategy update and the next brainstorm get real signal to anchor to.

Each cycle compounds: brainstorms sharpen plans, plans inform future plans, reviews catch more issues, patterns get documented.

### Quick Example

A typical cycle starts by turning a rough idea into a requirements doc, then planning from that doc before handing execution to `/ce-work`:

```text
/ce-brainstorm "make background job retries safer"
/ce-plan docs/brainstorms/background-job-retry-safety-requirements.md
/ce-work
/ce-code-review
/ce-compound
```

For a focused bug investigation:

```text
/ce-debug "the checkout webhook sometimes creates duplicate invoices"
/ce-code-review
/ce-compound
```
