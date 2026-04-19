# <Feature Name> Light Implementation Plan

## Objective

Implement `<feature summary>`.

This plan is intended for a smaller autonomous task.

The agent should be able to execute from this plan alone. Reading related spec files is optional for extra context, not required to proceed.

## Source Of Truth

Primary specification or issue:

- `<path to spec, issue, or task>`

Codebase integration points:

- `<existing file or module>`
- `<existing file or module>`

If the implementation encounters a minor ambiguity, prefer the smallest change that preserves this plan and existing repo patterns.

If this plan and a related spec differ in emphasis, follow this plan for implementation decisions because it is the execution-oriented handoff.

## Required Outcome

The finished implementation must provide:

- `<required outcome>`
- `<required outcome>`
- `<required outcome>`

## Constraints

- do not `<non-goal or prohibited change>`
- do not `<non-goal or prohibited change>`
- keep changes local to `<scope>`

## Exact Files To Touch

The agent should expect to edit these existing files:

- `<existing file>`
- `<existing file>`

The agent should expect to create these new files:

- `<new file>`

Avoid touching unrelated files unless a minimal adjustment is required to complete the task correctly.

## Implementation Defaults

If the agent must make a choice without asking for clarification, use these defaults:

- prefer the smallest correct change
- prefer explicit wiring over hidden magic
- avoid adding new abstractions unless they remove real duplication

## Implementation Steps

1. Update `<file>` to `<change>`.
2. Add `<type, function, or module>` in `<file>`.
3. Wire the change through `<file>`.
4. Add tests for `<behavior>`.
5. Run verification commands.

## Tests

Minimum required coverage:

- `<test case>`
- `<test case>`
- `<test case>`

Testing guidance:

- follow the repo’s existing test style
- keep tests focused on required behavior
- avoid brittle tests that lock in non-essential implementation details

## Verification

Run these commands after the code changes:

- `just tests`
- `just typecheck`
- `just fix-all`

If one verification command fails:

- fix the failure if it is caused by the feature changes
- if the failure is clearly unrelated pre-existing repo state, document it in the final handoff with enough detail for the user to reproduce

## Acceptance Criteria

The task is complete only if all of the following are true:

- `<acceptance criterion>`
- `<acceptance criterion>`
- tests added and passing
- `just tests`, `just typecheck`, and `just fix-all` succeed

## Delivery Format For The Agent

When the implementation is complete, the agent should be able to report:

- which files were created
- which existing files were edited
- what behavior was implemented
- what tests were added
- the result of `just tests`
- the result of `just typecheck`
- the result of `just fix-all`
- any deviations from the plan, if any

## Notes For The Agent

- prefer the smallest correct implementation
- do not stop after scaffolding; carry the work through tests and verification
- do not leave TODO comments as a substitute for implementation
