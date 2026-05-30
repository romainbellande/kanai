# Testing Guidelines

## Overview

Use the dominant test tooling in the workspace you touch: Vitest in `client/` and Pytest in `api/`.

## General Expectations

- Add focused tests with behavior changes instead of relying only on manual verification.
- Keep tests deterministic; avoid hidden network or environment dependencies.
- Keep new tests close to the workspace and patterns they exercise.

## Frontend Tests

- Full test suite: `bun --bun run test`
- Single test file: `bun --bun run test -- src/foo.test.ts`
- Single test by name: `bun --bun run test -- src/foo.test.ts -t "renders title"`
- Filter by test name only: `bun --bun run test -- -t "renders title"`
- Re-run in watch mode while debugging: `bunx vitest src/foo.test.ts -t "renders title"`
- There are no frontend test files in the repo today, but Vitest is installed and these commands are the expected pattern.
- Prefer Testing Library patterns over implementation-detail assertions.

## Backend Tests

- Full test suite: `just tests`
- Direct full test command: `uv run pytest -n auto -qq --show-capture=no --color=no`
- Single test file: `uv run pytest tests/test_example.py -q -n 0`
- Single test function: `uv run pytest tests/test_example.py::test_case_name -q -n 0`
- Filter by expression: `uv run pytest -k "user and not slow" -q -n 0`
- Re-run last failure: `uv run pytest --lf -q -n 0`
- Verbose debug run: `uv run pytest tests/test_example.py::test_case_name -s -vv -n 0`
- Use `-n 0` for targeted debugging so xdist does not add noise.
- Isolate state per test and avoid cross-test leakage.
