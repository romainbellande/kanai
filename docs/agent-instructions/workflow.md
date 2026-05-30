# Workflow Notes

## Overview

These notes cover repo-wide workflow and maintenance expectations that apply across `client/` and `api/`.

## Working Directory Rules

- Run frontend commands inside `client/`.
- Run backend commands inside `api/`.
- Do not assume repo-root scripts exist.
- When using an automation tool that supports per-command working directories, prefer that over `cd` chains.

## Infra Commands

- Start Keycloak locally: `docker compose up keycloak`
- Stop Keycloak: `docker compose stop keycloak`

## Tooling Checks

- Read nearby config files before changing tooling assumptions: `client/package.json`, `client/biome.json`, `client/tsconfig.json`, `api/Justfile`, and `api/pyproject.toml` are the key sources.
- If you touch generated-routing behavior, update route source files and let TanStack regenerate `client/src/routeTree.gen.ts`.
- If you change commands, tooling, or directory layout, update `AGENTS.md`, any more specific `AGENTS.md`, and these linked instruction files in the same task.

## Rules Files Checked

- No `.cursorrules` file was found.
- No `.cursor/rules/` directory was found.
- No `.github/copilot-instructions.md` file was found.
- There are currently no repo-local Cursor or Copilot rule files to merge into this guide.
