# Domain-Driven Development Implementation Plan

## Objective

Implement repo-level domain-driven development guardrails so new non-trivial backend capabilities are added as bounded contexts under `app/modules/`, while preserving `main.py` as the FastAPI composition point and keeping shared services technical and generic.

This plan is intended to be sufficient for an autonomous agent to implement the feature end to end.

The agent should be able to execute from this plan alone. Reading `docs/specs/domain_driven_development.spec.md` is optional for extra context, not required to proceed.

## Source Of Truth

Primary specification:

- `docs/specs/domain_driven_development.spec.md`

Codebase integration points:

- `main.py`
- `app/modules/auth/`
- `app/modules/seeder/startup.py`
- `app/modules/user/`
- `app/services/database_service.py`
- `app/services/redis_service.py`
- existing pytest style under `tests/`

If the implementation encounters a minor ambiguity, prefer the smallest change that preserves this plan and existing repo patterns.

If this plan and the spec differ in emphasis, follow this plan for implementation decisions because it is the execution-oriented handoff.

## Required Outcome

The finished implementation must provide:

- explicit repo guardrails that make `app/modules/<context_name>/` the default home for new non-trivial backend capabilities
- one concrete context-owned composition path so `main.py` wires a bounded context without building its internal dependencies inline
- executable architecture tests that enforce domain purity for opted-in bounded contexts and keep `app/services/` free of feature-specific imports
- incremental adoption rules so trivial modules may stay simple until they own meaningful business rules or external integrations

## Constraints

- do not rewrite every existing module into the new structure in this iteration
- do not change runtime behavior of authentication, seeding, or the existing user route just to satisfy the architecture work
- do not move generic database or Redis helpers out of `app/services/`
- do not add code generation, dynamic module discovery, or a large shared architecture framework
- keep changes local to bounded-context wiring, developer guidance, and architecture tests
- follow existing FastAPI, async SQLAlchemy, and pytest patterns already used in the repo

## Known Repo Assumptions

These assumptions are already true in the current repo and should be relied on unless the codebase changes during implementation:

- `main.py` is the current application composition point for startup wiring, middleware, and router registration
- `app/modules/auth/` is already the strongest DDD-style example in the repo and should be treated as the first concrete bounded context
- `app/modules/seeder/` is a richer module but is not required to be fully promoted in this iteration
- `app/modules/user/` is still trivial and may remain simple until it owns real business rules
- `app/services/database_service.py` and `app/services/redis_service.py` are technical shared services and must stay reusable across modules
- the repo already uses pytest for both focused unit tests and small wiring tests
- `just tests`, `just typecheck`, and `just fix-all` are the standard verification commands

Important implementation assumptions:

- the presence of a `domain/` package inside `app/modules/<name>/` is the opt-in marker that a module is being treated as an explicit bounded context
- architecture enforcement should rely on straightforward source inspection tests, not on metaprogramming or import-time magic
- `auth` should be the real example used to prove the bounded-context wiring pattern end to end

## Exact Files To Touch

The agent should expect to edit these existing files:

- `main.py`
- `tests/test_main.py`

The agent should expect to create these new files:

- `app/modules/auth/bootstrap.py`
- `app/modules/README.md`
- `tests/architecture/test_bounded_context_layout.py`
- `tests/architecture/test_domain_dependency_rules.py`
- `tests/architecture/test_shared_services_boundaries.py`
- `tests/modules/auth/test_bootstrap.py`

Optional new files:

- `tests/architecture/helpers.py` if small AST or import-parsing helpers would otherwise be duplicated across tests
- `app/modules/seeder/bootstrap.py` only if a tiny wrapper makes `main.py` composition materially clearer without changing behavior

Avoid touching unrelated runtime files unless a minimal adjustment is required to complete the task correctly.

## Implementation Defaults

If the agent must make a choice without asking for clarification, use these defaults:

- prefer one thin bootstrap file per promoted bounded context over a shared architecture helper module
- prefer explicit imports and explicit wiring over dynamic registration or discovery
- prefer source-inspection tests over brittle string matching when enforcing architecture rules
- prefer the existing `auth` module as the concrete reference implementation for a bounded context
- prefer leaving `user` untouched over promoting it prematurely
- prefer the smallest amount of code that satisfies tests and the plan

## Recommended File Layout

Create these files unless there is a strong reason to collapse or rename one of them:

- `app/modules/auth/bootstrap.py`
- `app/modules/README.md`
- `tests/architecture/test_bounded_context_layout.py`
- `tests/architecture/test_domain_dependency_rules.py`
- `tests/architecture/test_shared_services_boundaries.py`
- `tests/modules/auth/test_bootstrap.py`

You may add a small `__init__.py` if useful, but avoid unnecessary package surface area.

## Implementation Steps

### 1. Update bounded-context composition wiring

Update `main.py`.

Required changes:

- replace the inline auth dependency assembly with imports from a context-owned bootstrap file
- keep `main.py` responsible for top-level FastAPI composition only: lifespan, middleware registration, and router inclusion
- preserve existing seeder startup wiring and Redis shutdown wiring

Required behavior:

- `main.py` must stop constructing auth infrastructure pieces directly inline
- authentication behavior, configured audience handling, and whitelist paths must remain unchanged
- startup order must remain compatible with the current app lifecycle

Do not add new configuration or move router business logic into `main.py`.

### 2. Create the first explicit bootstrap contract

Create `app/modules/auth/bootstrap.py`.

Implement:

- `build_authenticate_request(...) -> AuthenticateRequest`
- `get_auth_whitelist_paths() -> set[str]` or one similarly small helper that keeps auth-owned configuration close to the module

Rules:

- this file is composition code, not a new business layer
- keep dependencies explicit by accepting the current settings object and Redis service instead of hiding globals behind a factory framework
- bootstrap code may depend on application, infrastructure, and interface pieces inside `auth`, but domain code must remain unchanged

Typing guidance:

- use straightforward Python typing that matches the current repo
- prefer one or two plain helper functions over introducing classes or registries here

### 3. Add lightweight developer guidance for future contexts

Create `app/modules/README.md`.

Implement:

- the default bounded-context layout for promoted modules: `domain/`, `application/`, `infrastructure/`, and `interface/`
- when a flat module is still acceptable because behavior is trivial
- where routers, startup hooks, external adapters, and shared technical services belong

Required behavior:

- point to `app/modules/auth/` as the concrete reference example
- explain that `app/services/` is reserved for technical shared services, not feature policy
- keep the guide short enough that it can be read quickly during feature work

Implementation guidance:

- keep this focused on local repo conventions, not generic DDD theory
- do not duplicate the full spec verbatim

### 4. Add architecture guardrail tests

Create `tests/architecture/test_bounded_context_layout.py` and `tests/architecture/test_domain_dependency_rules.py`.

Required behavior for `test_bounded_context_layout.py`:

- scan `app/modules/*`
- if a module contains a `domain/` package, require sibling `application/`, `infrastructure/`, and `interface/` packages
- allow modules without `domain/` to remain simple so incremental adoption still works

Required behavior for `test_domain_dependency_rules.py`:

- inspect Python imports under `app/modules/*/domain/**/*.py`
- fail if domain code imports FastAPI or Starlette delivery concerns
- fail if domain code imports sibling `interface` or `infrastructure` packages
- fail if domain code imports `app.services` directly, because shared technical services must be reached through application and infrastructure layers instead

Implementation guidance:

- use AST parsing or similarly robust source inspection
- keep failure messages specific enough to identify the violating file and import
- avoid trying to encode the entire architecture as a large custom framework

Decision rule:

- if a proposed guardrail would incorrectly fail the current `auth` module or require rewriting `user` or `seeder`, narrow the rule to the opted-in bounded-context case instead of broadening the code changes

### 5. Guard shared services from feature leakage

Create `tests/architecture/test_shared_services_boundaries.py`.

Required behavior:

- inspect imports under `app/services/**/*.py`
- fail if shared services import anything from `app.modules.`
- allow shared services to depend on configuration, exceptions, database, Redis, and other generic technical libraries already used in the repo

Error guidance:

- failure messages should name the shared service file and the feature-specific import that leaked into it
- keep the rule focused on feature leakage; do not try to enforce unrelated style conventions here

### 6. Add one real usage path that proves the pattern

Add the real implementation path through `auth`.

Recommended behavior:

- `main.py` should build auth middleware dependencies through `app/modules/auth/bootstrap.py`
- the bootstrapped auth path should still protect existing routes without requiring a new endpoint or feature flow

Keep this minimal. Do not invent a new demo module just to illustrate the architecture.

### 7. Integrate into the application lifecycle

Update `main.py`.

Required order:

1. create database tables when the current environment allows it
2. run reference data seeding when the current environment allows it
3. preserve Redis shutdown on app shutdown

Be careful not to break existing lifecycle wiring while changing auth composition.

### 8. Add tests

Add tests under `tests/architecture/` and `tests/modules/auth/`.

Minimum required coverage:

- a promoted bounded context is required to have `domain`, `application`, `infrastructure`, and `interface` packages
- domain-layer files reject imports from FastAPI, Starlette, `app.services`, and sibling delivery or infrastructure layers
- shared services reject imports from `app.modules`
- auth bootstrap builds an `AuthenticateRequest` with the configured OIDC audience and Redis-backed session repository
- `main.py` still wires the app through the auth bootstrap path without breaking existing startup expectations

Recommended additional coverage if cheap:

- verify the auth whitelist helper keeps the current documented public paths
- verify the architecture tests ignore trivial flat modules that have not yet opted into a `domain/` package

Testing guidance:

- follow the repo's existing pytest style
- prefer focused unit tests for bootstrap and source-inspection logic
- add only the minimal wiring test needed to prove `main.py` uses the new bootstrap helper
- avoid brittle tests that depend on exact formatting or import ordering when the behavior under test is architectural intent

Suggested split:

- `tests/modules/auth/test_bootstrap.py`: auth bootstrap construction behavior
- `tests/architecture/test_bounded_context_layout.py`: bounded-context package layout rules
- `tests/architecture/test_domain_dependency_rules.py`: domain purity rules
- `tests/architecture/test_shared_services_boundaries.py`: shared technical service boundary rules
- `tests/test_main.py`: top-level composition still works with the auth bootstrap indirection

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

- `main.py` remains the FastAPI composition point but now consumes an auth-owned bootstrap helper instead of assembling auth internals inline
- the repo contains executable architecture tests that enforce bounded-context layout for opted-in modules and prevent framework or shared-service leakage into domain code
- the repo contains an explicit guardrail that keeps `app/services/` generic and free of `app.modules` imports
- `app/modules/README.md` gives a short repo-specific guide for when to keep a module simple and when to promote it into a full bounded context
- trivial modules such as `app/modules/user/` are still allowed to remain simple without failing the new tests
- all required tests were added and are passing
- `just tests`, `just typecheck`, and `just fix-all` succeed

## Delivery Format For The Agent

When the implementation is complete, the agent should be able to report:

- which files were created
- which existing files were edited
- what bounded-context guardrails were implemented
- what runtime wiring changed in `main.py`
- what tests were added
- the result of `just tests`
- the result of `just typecheck`
- the result of `just fix-all`
- any deviations from the plan, if any

## Notes For The Agent

- prefer the smallest correct implementation
- do not stop after adding docs or scaffolding; carry the work through tests and verification
- do not leave TODO comments as a substitute for architecture enforcement
- if an ambiguity remains after consulting the plan, choose the behavior that preserves incremental adoption and keeps business rules closest to the owning module
