# <Feature Name> Spec

## Goal

Describe the feature or behavior to add.

State the user or business outcome clearly, without describing implementation structure.

## Problem

Describe the current limitation, gap, or risk.

Include only the context needed to explain why this change is necessary.

## Scope

This spec covers:

- `<in-scope behavior>`
- `<in-scope behavior>`
- `<in-scope behavior>`

This spec does not cover:

- `<out-of-scope item>`
- `<out-of-scope item>`

## Existing Context

List relevant product or codebase facts that the behavior must align with.

- `<existing constraint or integration point>`
- `<existing constraint or integration point>`
- `<existing constraint or integration point>`

## Required Behavior

The finished feature must provide:

- `<required behavior>`
- `<required behavior>`
- `<required behavior>`

## User Or System Flow

Describe the expected behavior in sequence.

1. `<step in the flow>`
2. `<step in the flow>`
3. `<step in the flow>`

## Rules And Constraints

Define invariants, policy rules, and behavioral constraints.

- `<rule or invariant>`
- `<rule or invariant>`
- `<rule or invariant>`

## Data Expectations

Describe the data shape or data guarantees at the product or domain level.

Required data:

- `<required field or concept>`
- `<required field or concept>`

Optional data:

- `<optional field or concept>`
- `<optional field or concept>`

Validation or consistency rules:

- `<data rule>`
- `<data rule>`

## Error Cases

Describe expected failure modes and required outcomes.

- when `<failure condition>`, the system must `<expected outcome>`
- when `<failure condition>`, the system must `<expected outcome>`
- when `<failure condition>`, the system must `<expected outcome>`

## Environment Or Runtime Rules

Document any environment-specific behavior if relevant.

- in `<environment>`, `<expected behavior>`
- in `<environment>`, `<expected behavior>`

If not relevant, remove this section.

## Observability Or Audit Requirements

Document any required logging, metrics, traceability, or audit expectations.

- `<observability requirement>`
- `<observability requirement>`

If not relevant, remove this section.

## Security And Privacy

Document any security, authorization, privacy, or data-handling rules.

- `<security or privacy rule>`
- `<security or privacy rule>`

If not relevant, remove this section.

## Acceptance Criteria

This spec is satisfied only if all of the following are true:

- `<acceptance criterion>`
- `<acceptance criterion>`
- `<acceptance criterion>`

## Testing Expectations

Describe what behaviors must be verified, without prescribing test file structure or implementation approach.

- `<behavior that must be tested>`
- `<behavior that must be tested>`
- `<behavior that must be tested>`

## Notes

- keep this document focused on expected behavior, not implementation structure
- move execution details, file plans, and sequencing into a corresponding plan document under `docs/plans/`
