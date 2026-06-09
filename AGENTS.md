# Kanai Agent Guide

This repository has two active workspaces: `client/` and `api/`.

## Scope And Precedence

- Follow the most specific instructions available for the directory you edit.
- `api/AGENTS.md` overrides this file for backend work.
- Run frontend commands inside `client/` and backend commands inside `api/`.
- Do not assume repo-root scripts exist.
- Prefer per-command working directories over `cd` chains when tooling supports them.

## Instructions

- When API schema change, DO NOT require a database migration for now.

## Quick Reference

- Frontend: React 19, Vite 7, TanStack Router, TypeScript, Vitest, Tailwind CSS v4, Biome.
- Backend: FastAPI, `uv`, Ruff, ty, Pytest, SQLAlchemy asyncio, Alembic, Pydantic Settings.
- Infra: `compose.yml` defines a local Keycloak service.

## Commands

- Frontend install: `bun install`
- Frontend dev: `bun --bun run dev`
- Frontend verification: `bun --bun run check` and `bun --bun run test`
- Backend install: `uv sync --group dev`
- Backend dev: `just dev`
- Backend verification: `just typecheck` and `just tests`
- Keycloak: `docker compose up keycloak`

## Quality Gate

The current quality gate is `just pre-commit`

## Detailed Instructions

- [Frontend Guidelines](docs/agent-instructions/frontend.md)
- [Backend Guidelines](docs/agent-instructions/backend.md)
- [Testing Guidelines](docs/agent-instructions/testing.md)
- [Workflow Notes](docs/agent-instructions/workflow.md)

<!-- br-agent-instructions-v1 -->

---

## Beads Workflow Integration

This project uses [beads_rust](https://github.com/Dicklesworthstone/beads_rust) (`br`/`bd`) for issue tracking. Issues are stored in `.beads/` and tracked in git.

### Essential Commands

```bash
# View ready issues (open, unblocked, not deferred)
br ready              # or: bd ready

# List and search
br list --status=open # All open issues
br show <id>          # Full issue details with dependencies
br search "keyword"   # Full-text search

# Create and update
br create --title="..." --description="..." --type=task --priority=2
br update <id> --status=in_progress
br close <id> --reason="Completed"
br close <id1> <id2>  # Close multiple issues at once

# Sync with git
br sync --flush-only  # Export DB to JSONL
br sync --status      # Check sync status
```

### Workflow Pattern

1. **Start**: Run `br ready` to find actionable work
2. **Claim**: Use `br update <id> --status=in_progress`
3. **Work**: Implement the task
4. **Complete**: Use `br close <id>`
5. **Sync**: Always run `br sync --flush-only` at session end

### Key Concepts

- **Dependencies**: Issues can block other issues. `br ready` shows only open, unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers 0-4, not words)
- **Types**: task, bug, feature, epic, chore, docs, question
- **Blocking**: `br dep add <issue> <depends-on>` to add dependencies

### Session Protocol

**Before ending any session, run this checklist:**

```bash
git status              # Check what changed
git add <files>         # Stage code changes
br sync --flush-only    # Export beads changes to JSONL
git commit -m "..."     # Commit everything
git push                # Push to remote
```

### Best Practices

- Check `br ready` at session start to find available work
- Update status as you work (in_progress → closed)
- Create new issues with `br create` when you discover tasks
- Use descriptive titles and set appropriate priority/type
- Always sync before ending session

<!-- end-br-agent-instructions -->
