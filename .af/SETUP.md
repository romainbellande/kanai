# AF Setup

## Purpose

Project-specific AF guidance for Kanai. `af-to-prd` and `af-to-issues` should read this before creating artifacts.

## Project Quality Gates

- Run `just pre-commit` from the repo root before a code slice is done.
- For frontend-only changes, run `bun --bun run check` and `bun --bun run test`
  in `client/` when a narrower gate is useful.
- For backend-only changes, run `just typecheck` and `just tests` in `api/` when a narrower gate is useful.
- Regenerate the OpenAPI client with `just gen-openapi-client` when backend API
  contracts used by the client change.

## Project Definition of Done

- Kanai behavior changed by the slice is visible in the app, API, or documented workflow.
- The relevant quality gate has passed, or the issue records the exact manual
  verification when automation is not practical.
- Related Beads issues are updated or closed.

## Project Acceptance Criteria Guidance

- Use Kanai vocabulary from `CONTEXT.md`, especially Project, Project Task,
  Sprint, Backlog, Workflow Column, Acceptance Criteria, and Finished Task.
- Avoid banned terms listed in `CONTEXT.md` when naming PRDs, issues, and acceptance criteria.
- Tie criteria to observable Kanai behavior such as task shaping, project
  dashboards, sprint planning, backlog order, or workflow board changes.

## Project Vertical Slice Guidance

- Prefer slices that can be verified through one Kanai workflow, route, API capability, or user action.
- Split broad work by Project Task, Sprint, Backlog, Project Dashboard, auth, or
  API-client contract boundary when that keeps each slice independently verifiable.
- Reject Kanai issues that only add unused models, generated client types, empty
  UI shells, or uncalled services.

## Project Dependency Policy

- Use Beads for durable dependency tracking; do not add Markdown task lists.
- Use `discovered-from:<parent-id>` for follow-up work discovered while implementing a parent PRD or issue.
- Keep dependency notes short in Markdown and leave the dependency graph in Beads.

## Project PRD Defaults

- PRDs should call out Kanai domain terms from `CONTEXT.md` when they affect scope or naming.
- PRDs should mention whether work touches `client/`, `api/`, generated OpenAPI
  client code, or local infrastructure.
- Do not require database migrations for API schema changes unless the user explicitly asks.

## Project Issue Defaults

- Use Beads issue types already used by this repo: `feature`, `bug`, `task`,
  `epic`, or `chore`.
- Default priority is `2` unless the user or production risk implies otherwise.
- Include the relevant repo command from the quality gates above in each issue's quality gate.

## Out of Scope by Default For This Project

- New dependencies, frameworks, or broad abstractions unless they are the smallest working option.
- Large refactors bundled with feature slices.
- Cosmetic redesigns outside the requested Kanai behavior.
- Extra schema migrations for API-only contract changes unless requested.
- Parallel tracking systems outside Beads.

## Notes

None.
