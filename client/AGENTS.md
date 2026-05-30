# AGENTS

## Scope

These instructions apply to the `/home/naimor/dev/perso/kanai/client` app.

## Package Manager

- Use `bun` for dependency management and scripts.
- Do not use `npm`.
- Prefer the existing lockfile in this folder: `bun.lock`.

## Common Commands

- Install dependencies: `bun install`
- Start the dev server: `bun --bun run dev`
- Build the app: `bun --bun run build`
- Run tests: `bun --bun run test`
- Run lint: `bun --bun run lint`
- Run format: `bun --bun run format`
- Run full checks: `bun --bun run check`

## Project Notes

- This is a Vite + React + TypeScript app.
- Biome is used for linting and formatting.
- Vitest is used for tests.
- TanStack Router is used for routing.

## Working Agreement

- Keep changes minimal and consistent with the existing codebase.
- Prefer updating existing files over introducing new abstractions unless needed.
- Run the relevant `bun` command(s) after code changes when feasible.
