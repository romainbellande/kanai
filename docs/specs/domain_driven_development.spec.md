# Domain-Driven Development Spec

## Goal

Define how non-trivial backend features should be modeled and added to this API using domain-driven development.

The outcome is a consistent bounded-context structure that keeps business rules close to the feature they belong to, while preserving the current FastAPI application entrypoint and shared technical services.

## Problem

The codebase already has multiple feature areas and shared technical services.

Without an explicit DDD specification, future work can drift into a mix of routers, `main.py`, and generic shared services, which makes feature ownership unclear and causes business rules to leak across unrelated parts of the application.

## Scope

This spec covers:

- how new non-trivial backend features are organized under `app/modules/`
- how bounded contexts own their business rules and use cases
- how domain, application, infrastructure, and interface responsibilities are separated

This spec does not cover:

- rewriting every existing module into a new architecture immediately
- changing FastAPI, SQLAlchemy, Redis, or other chosen libraries

## Existing Context

List relevant product or codebase facts that the behavior must align with.

- `main.py` is the current application composition point for startup wiring, middleware, and routers
- `app/services/` holds shared technical building blocks such as database and Redis access
- `app/modules/auth/` already demonstrates a DDD-style bounded context with domain, application, infrastructure, and interface layers
- `app/modules/seeder/` and `app/modules/user/` show that the codebase currently mixes richer and simpler module structures, so this spec must support incremental adoption rather than a forced rewrite

## Required Behavior

The finished feature must provide:

- each new non-trivial business capability must be implemented as a dedicated bounded context under `app/modules/<context_name>/`
- each bounded context must own its domain rules, application orchestration, and external adapters instead of placing feature logic in `main.py` or generic shared services
- dependency flow must move inward: interface and infrastructure may depend on application and domain code, while domain code must not depend on FastAPI or other delivery concerns
- shared code outside a bounded context must stay technical and generic; feature-specific policies must remain inside the owning module

## User Or System Flow

Describe the expected behavior in sequence.

1. A new backend feature or domain capability is identified.
2. The feature is assigned a bounded context under `app/modules/<context_name>/`.
3. Domain concepts, invariants, and use cases are defined inside that bounded context before transport and storage details are applied.
4. Interface code such as routers, middleware, or startup hooks delegates feature decisions to application-layer behavior.
5. Infrastructure code adapts persistence, caching, network calls, or framework integrations to the contracts owned by the bounded context.
6. `main.py` or equivalent application composition code wires the context into the running app.

## Rules And Constraints

Define invariants, policy rules, and behavioral constraints.

- domain code must not depend on FastAPI request or response objects, router decorators, or middleware types
- shared services under `app/services/` must not absorb feature-specific business rules that belong to one bounded context
- a bounded context may reuse shared technical services such as `database_service` or `redis_service`, but only through the context's own use cases and adapters
- simple modules may start with a smaller structure when behavior is trivial, but once a feature owns meaningful business rules or external integrations, it must be promoted to an explicit bounded context

## Data Expectations

Describe the data shape or data guarantees at the product or domain level.

Required data:

- a clearly named bounded context directory under `app/modules/`
- explicit domain concepts, use cases, and external integration boundaries for the feature

Optional data:

- dedicated value objects, DTOs, or repository contracts when they clarify the domain language
- separate infrastructure models or persistence adapters when the feature's complexity justifies them

Validation or consistency rules:

- input validation must happen at the system boundary or in boundary DTOs before domain state is changed
- domain invariants must be enforced inside the owning bounded context and must not rely on router-only checks

## Error Cases

Describe expected failure modes and required outcomes.

- when a feature-specific rule is implemented in `main.py`, a router, or a generic shared service instead of its bounded context, the change must be treated as architecture-noncompliant and corrected before acceptance
- when interface input is invalid, the bounded context must reject the request before applying domain changes
- when an external dependency fails, the infrastructure adapter must surface a bounded-context-specific failure to the application or interface layer rather than leaking raw integration details broadly across the codebase

## Security And Privacy

Document any security, authorization, privacy, or data-handling rules.

- secrets, credentials, and transport-specific auth data must stay at interface or infrastructure boundaries unless a domain concept explicitly requires a derived safe representation
- bounded contexts must expose only the minimum data required by other parts of the application and should avoid leaking raw external payloads outside their owning module

## Acceptance Criteria

This spec is satisfied only if all of the following are true:

- a reviewer can identify one owning bounded context for each new non-trivial backend feature
- business rules for that feature live in the owning module rather than being spread across `main.py`, routers, and shared services
- interface wiring, application orchestration, domain rules, and infrastructure concerns are separated clearly enough that each layer can change without forcing unrelated cross-cutting edits
- shared technical services remain generic and reusable across modules

## Testing Expectations

Describe what behaviors must be verified, without prescribing test file structure or implementation approach.

- bounded-context use cases must be testable without requiring the full FastAPI app to run
- interface-layer tests must verify that requests are translated into application calls and expected responses or failures
- infrastructure-layer tests must verify adaptation of external systems without becoming the only place where feature behavior is validated

## Notes

- keep this document focused on expected behavior, not implementation structure
- move execution details, file plans, and sequencing into a corresponding plan document under `docs/plans/`
