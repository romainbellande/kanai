# AF Setup

## Purpose

Repo-wide defaults for AF PRDs and issues. `af-to-prd` and `af-to-issues` should read this before creating artifacts.

## Quality Gates

- Run `just pre-commit` before a slice is done when code changed.
- For frontend-only changes, `bun --bun run check` and `bun --bun run test` in
  `client/` are acceptable focused gates before the full gate.
- For backend-only changes, `just typecheck` and `just tests` in `api/` are
  acceptable focused gates before the full gate.
- Regenerate the OpenAPI client with `just gen-openapi-client` when API contracts used by the client change.

## Definition of Done

- The changed behavior is externally observable in the app, API, or documented workflow.
- Acceptance criteria are satisfied with focused tests, checks, or a clear manual verification note.
- Related Beads issues are updated or closed with the completion reason.
- Follow-up work discovered during implementation is filed in Beads instead of left as a Markdown TODO.

## Acceptance Criteria Style

- Write acceptance criteria as user- or system-visible outcomes, not implementation chores.
- Prefer concrete Given/When/Then-style bullets when state transitions, permissions, or workflows matter.
- Include the smallest verification command or manual check that proves each critical outcome.

## Vertical Slice Rules

- Prefer one thin end-to-end behavior change per issue.
- A good slice can usually be implemented, tested, reviewed, and explained independently.
- Reject horizontal-only issues such as "add all models", "build the service
  layer", "wire the UI shell", or "refactor everything" unless explicitly
  requested as technical setup.
- Split broad work by user-visible outcome, route, workflow step, or API capability.

## Dependency Policy

- Dependencies are allowed only when one issue cannot be safely verified before another exists.
- Record dependencies in Beads with `--deps`, using
  `discovered-from:<parent-id>` for follow-up work found during implementation.
- Avoid dependency chains created only by architecture layers; prefer slices that cross layers when needed.

## PRD Defaults

- Use Kanai domain vocabulary from `CONTEXT.md`.
- Keep PRDs scoped to the current user request and call out explicit non-goals.
- Prefer Beads parent issues for durable PRD tracking, with child issues for implementation slices.
- Do not require database migrations for API schema changes unless the user explicitly asks.

## Issue Defaults

- Track implementation work in Beads, not Markdown task lists.
- Use `feature`, `bug`, `task`, `epic`, or `chore` types with priority `2` unless urgency is clear.
- Include acceptance criteria, relevant quality gate commands, and dependency notes.
- Keep issue descriptions short enough to execute, but complete enough for another agent to resume.

## Out of Scope by Default

- New dependencies, frameworks, or broad abstractions unless they are the smallest working option.
- Large refactors bundled with feature slices.
- Cosmetic redesigns outside the requested behavior.
- Extra schema migrations for API-only contract changes unless requested.
- Parallel tracking systems outside Beads.

## Notes

None.
