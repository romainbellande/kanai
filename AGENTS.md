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

The current quality gate is `just pre-commit`. It runs frontend checks including the client production build.

## Detailed Instructions

- Documented solutions: `docs/solutions/` stores past fixes and guidance by category with YAML frontmatter (`module`, `tags`, `problem_type`), relevant when implementing or debugging in documented areas.
- [Frontend Guidelines](docs/agent-instructions/frontend.md)
- [Backend Guidelines](docs/agent-instructions/backend.md)
- [Testing Guidelines](docs/agent-instructions/testing.md)
- [Workflow Notes](docs/agent-instructions/workflow.md)


<!-- BEGIN BEADS INTEGRATION v:1 profile:full hash:0a1bbe8a -->
## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Dolt-powered version control with native sync
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**

```bash
bd ready --json
```

**Create new issues:**

```bash
bd create "Issue title" --description="Detailed context" -t bug|feature|task -p 0-4 --json
bd create "Issue title" --description="What this issue is about" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**

```bash
bd update <id> --claim --json
bd update bd-42 --priority 1 --json
```

**Complete work:**

```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task atomically**: `bd update <id> --claim`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" --description="Details about what was found" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`

### Quality
- Use `--acceptance` and `--design` fields when creating issues
- Use `--validate` to check description completeness

### Lifecycle
- `bd defer <id>` / `bd supersede <id>` for issue management
- `bd stale` / `bd orphans` / `bd lint` for hygiene
- `bd human <id>` to flag for human decisions
- `bd formula list` / `bd mol pour <name>` for structured workflows

### Auto-Sync

bd automatically syncs via Dolt:

- Each write auto-commits to Dolt history
- No manual export/import needed!

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

For more details, see README.md and docs/QUICKSTART.md.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Clean up** - Clear stashes, prune remote branches
5. **Verify** - All changes committed AND pushed
6. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

<!-- END BEADS INTEGRATION -->
