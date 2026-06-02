## Parent PRD

`issues/prd.md`

## What to build

Move project membership replacement and user validation behavior into the `ProjectAccess` policy from PRD section 1. This slice should make project update flows rely on the policy for membership semantics while keeping project service focused on project orchestration and response behavior.

## Acceptance criteria

- [x] `ProjectAccess.validate_users_exist` validates known and unknown user IDs with the existing API error semantics.
- [x] `ProjectAccess.replace_membership` preserves acting-user ownership and applies owner/member replacement rules.
- [x] Project update flows use `ProjectAccess` for user validation and membership replacement.
- [x] Boundary tests cover known/unknown user validation and acting-user ownership preservation during membership replacement.
- [ ] Backend verification passes with `just typecheck` and `just tests`.

## Blocked by

- Blocked by `issues/001-introduce-project-access-policy.md`

## User stories addressed

- PRD section 1

## Completion note

Implementation is complete, but local verification is blocked because `uv` and `uvx` are unavailable. `just typecheck` and `just tests` both fail when invoking those tools.
