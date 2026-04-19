# <Feature Name> Implementation Plan

## Objective

Implement `<feature summary>`.

This plan is intended to be sufficient for an autonomous agent to implement the feature end to end.

The agent should be able to execute from this plan alone. Reading related spec files is optional for extra context, not required to proceed.

## Source Of Truth

Primary specification:

- `<path to primary spec>`

Codebase integration points:

- `<existing file or module>`
- `<existing file or module>`
- `<existing file or module>`

If the implementation encounters a minor ambiguity, prefer the smallest change that preserves this plan and existing repo patterns.

If this plan and the spec differ in emphasis, follow this plan for implementation decisions because it is the execution-oriented handoff.

## Required Outcome

The finished implementation must provide:

- `<required outcome>`
- `<required outcome>`
- `<required outcome>`

## Constraints

- do not `<non-goal or prohibited change>`
- do not `<non-goal or prohibited change>`
- keep changes local to `<scope>`
- follow existing repo patterns for `<area>`

## Known Repo Assumptions

These assumptions are already true in the current repo and should be relied on unless the codebase changes during implementation:

- `<repo assumption>`
- `<repo assumption>`
- `<repo assumption>`

Important implementation assumptions:

- `<important assumption>`
- `<important assumption>`

## Exact Files To Touch

The agent should expect to edit these existing files:

- `<existing file>`
- `<existing file>`

The agent should expect to create these new files:

- `<new file>`
- `<new file>`
- `<new file>`

Optional new files:

- `<optional file>`

Avoid touching unrelated files unless a minimal adjustment is required to complete the task correctly.

## Implementation Defaults

If the agent must make a choice without asking for clarification, use these defaults:

- prefer `<default choice>` over `<alternative>`
- prefer `<default choice>`
- prefer the smallest amount of code that satisfies tests and the plan

## Recommended File Layout

Create these files unless there is a strong reason to collapse or rename one of them:

- `<file path>`
- `<file path>`
- `<file path>`

You may add a small `__init__.py` if useful, but avoid unnecessary package surface area.

## Implementation Steps

### 1. Update configuration or core wiring

Update `<file>`.

Required changes:

- `<change>`
- `<change>`

Required behavior:

- `<behavior>`
- `<behavior>`

Do not add new configuration unless it is truly necessary.

### 2. Create core contracts or types

Create `<file>`.

Implement:

- `<type or contract>`
- `<type or contract>`

Rules:

- `<rule>`
- `<rule>`

Typing guidance:

- use straightforward typing that fits the current codebase
- avoid overengineering generics if they reduce clarity

### 3. Implement core services or logic

Create `<file>`.

Implement:

- `<service or function>`
- `<service or function>`

Required behavior:

- `<behavior>`
- `<behavior>`
- `<behavior>`

Implementation guidance:

- keep this focused and minimal
- do not introduce abstraction layers unless they remove real duplication

Decision rule:

- if a design choice becomes noisy or overly abstract, prefer the simpler precise-enough option

### 4. Implement orchestration

Create or update `<file>`.

Required behavior:

- `<behavior>`
- `<behavior>`
- `<behavior>`

Error guidance:

- preserve original exceptions when re-raising unless translation is required by the architecture
- error messages should include the failing unit or dependency when useful

### 5. Register or wire the feature

Create or update `<file>`.

Rules:

- use explicit registration over dynamic discovery unless the task explicitly requires discovery
- keep wiring easy to test and reason about

### 6. Add at least one real usage path

Add one real implementation path that proves the feature works end to end.

Recommended behavior:

- `<behavior>`
- `<behavior>`

Keep the payload or example minimal. Do not invent unrelated fields, fixtures, or flows.

### 7. Integrate into the application lifecycle

Update `<file>`.

Required order:

1. `<step>`
2. `<step>`
3. `<step>`

Be careful not to break existing lifecycle wiring.

### 8. Add tests

Add tests under `<path>`.

Minimum required coverage:

- `<test case>`
- `<test case>`
- `<test case>`
- `<test case>`

Recommended additional coverage if cheap:

- `<optional test case>`
- `<optional test case>`

Testing guidance:

- follow the repo’s existing test style
- prefer focused unit tests for local behavior
- add integration tests only where lifecycle or wiring must be proven
- avoid brittle tests that lock in non-essential implementation details

Suggested split:

- `<test file>`: `<scope>`
- `<test file>`: `<scope>`
- `<test file>`: `<scope>`

### 9. Verify the implementation

Run these commands after the code changes:

- `just tests`
- `just typecheck`
- `just fix-all`

If formatting changes touch newly edited files, keep them.

If one verification command fails:

- fix the failure if it is caused by the feature changes
- if the failure is clearly unrelated pre-existing repo state, document it in the final handoff with enough detail for the user to reproduce

## Acceptance Criteria

The task is complete only if all of the following are true:

- `<acceptance criterion>`
- `<acceptance criterion>`
- `<acceptance criterion>`
- all required tests were added and are passing
- `just tests`, `just typecheck`, and `just fix-all` succeed

## Delivery Format For The Agent

When the implementation is complete, the agent should be able to report:

- which files were created
- which existing files were edited
- what core behavior was implemented
- what tests were added
- the result of `just tests`
- the result of `just typecheck`
- the result of `just fix-all`
- any deviations from the plan, if any

## Notes For The Agent

- prefer the smallest correct implementation
- do not stop after scaffolding; carry the work through tests and verification
- do not leave TODO comments as a substitute for implementation
- if an ambiguity remains after consulting the plan, choose the behavior that is safest, easiest to test, and most consistent with the existing codebase
