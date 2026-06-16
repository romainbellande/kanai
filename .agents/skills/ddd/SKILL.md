---
name: ddd
description: Use when modeling business rules, bounded contexts, aggregates, entities, value objects, repositories, or application services with Domain-Driven Design.
---

# Domain-Driven Development

Use this skill when the task involves business rules, domain modeling, bounded contexts, aggregates, entities, value objects, domain services, repositories, or application services.

This skill is designed to combine with `atomic-design` when a feature needs both strong domain boundaries and clear UI composition.

## Goal

Model software around the business domain instead of technical layers. Drive implementation from domain language, invariants, and boundaries so behavior stays correct as the codebase grows.

When paired with atomic design, let the domain model define what the UI needs to express, while atoms, molecules, organisms, templates, and pages define how that behavior is presented.

## Use This Skill When

- The user asks for a design or implementation using Domain-Driven Development.
- The task contains rich business rules or state transitions.
- A feature spans multiple concepts that need clear ownership and boundaries.
- Existing code is mixing UI, persistence, and domain logic.
- You need to clarify terminology, invariants, or aggregate responsibilities.
- A UI change depends on business states, permissions, workflows, or domain vocabulary.

## Core Principles

1. Start with the domain language. Reuse the user's business terms consistently.
2. Distinguish domain concerns from transport, storage, and presentation.
3. Protect invariants inside the domain model, not at random call sites.
4. Keep bounded contexts explicit. Avoid leaking concepts across them.
5. Prefer small, intention-revealing domain types over generic objects.
6. Model behavior close to the data it governs.
7. Use application services to orchestrate use cases, not to hold business rules.
8. Repositories load and persist aggregates; they do not contain domain policy.
9. When a feature has UI work, expose domain meaning to the UI through clear application-facing view models or props, not through leaked persistence details.

## Combining With Atomic Design

Use both skills together with this boundary:

1. Domain layer decides business meaning.
2. Application layer translates use cases into UI-ready state.
3. Atomic design organizes the presentation into atoms, molecules, organisms, templates, and pages.

Practical rule:
- DDD answers `what rules and concepts exist?`
- Atomic design answers `where should the UI for those concepts live?`

Examples:
- A `Subscription` domain concept may appear in the UI as a `SubscriptionStatusBadge` atom, a `SubscriptionActions` molecule, and a `SubscriptionOverview` organism.
- An `Order` aggregate may drive page states like draft, submitted, and cancelled, while the route page composes the right organisms for each state.

## Working Process

1. Identify the business capability being changed.
2. Extract the ubiquitous language from the request and the codebase.
3. List the main concepts:
   - Entities
   - Value objects
   - Aggregates
   - Domain services
   - Repositories
   - Application services
   - Domain events if they add real value
4. Define invariants and lifecycle rules before changing code.
5. Choose the bounded context and confirm which concepts belong inside it.
6. If the feature has UI, identify which user-visible states or actions the domain needs to expose.
7. Hand those states and actions to the UI through application services, selectors, presenters, or explicit props.
8. Implement the smallest change that strengthens the domain model.
9. Verify behavior with tests focused on domain rules and use cases.

## Modeling Heuristics

### Entities

Use an entity when identity and lifecycle matter.

Examples:
- `Order`
- `Invoice`
- `Subscription`

### Value Objects

Use a value object when identity does not matter and equality is based on attributes.

Examples:
- `Money`
- `EmailAddress`
- `DateRange`

Value objects should usually be immutable and validated on creation.

### Aggregates

Use aggregates to enforce consistency boundaries.

Rules:
- Put invariants behind aggregate methods.
- Reference other aggregates by identity unless there is a strong reason not to.
- Keep aggregate boundaries tight to avoid loading too much state.

### Domain Services

Use a domain service only when behavior is domain-specific but does not naturally belong to a single entity or value object.

### Application Services

Application services should:
- Accept a command or use-case input.
- Load required aggregates.
- Invoke domain behavior.
- Persist results.
- Publish events or trigger side effects through ports when needed.

They should not become a dumping ground for business logic.

## Implementation Guidance

- Prefer folders and names that reflect the domain, not framework categories alone.
- Keep HTTP handlers, React components, ORM models, and database concerns outside the domain layer where practical.
- Translate external payloads into domain concepts at the boundary.
- When UI is involved, translate domain outcomes into presentation state before they reach atoms or molecules.
- Do not make React components responsible for enforcing aggregate invariants.
- Let route pages and organisms render domain states, but keep rule enforcement in domain or application code.
- If the project is small, apply DDD concepts lightly. Do not force extra layers with no payoff.
- If an existing architecture already has conventions, align with it while improving domain clarity.

## Testing Guidance

Prioritize tests in this order:

1. Domain behavior and invariants.
2. Application service use cases.
3. Boundary mapping where bugs are likely.
4. UI integration around domain-driven states when a route depends on them.

Tests should read in business language where possible.

## Decision Rules

- If a rule must always be true, enforce it in the domain model.
- If logic only coordinates dependencies, keep it in an application service.
- If a type mainly validates and carries meaning, make it a value object.
- If a UI component needs to know business status, pass it a domain-derived state instead of raw persistence fields.
- If a route is branching on business rules, move that branching decision closer to the application or domain boundary unless it is purely presentational.
- If introducing DDD structure adds more ceremony than clarity, simplify.

## Output Expectations

When using this skill, provide:

1. The bounded context being changed.
2. The key domain concepts involved.
3. The invariants or rules being enforced.
4. The user-visible states or actions exposed to the UI.
5. The minimal code changes needed.
6. Any tradeoffs where full DDD would be too heavy for the current codebase.

## Anti-Patterns To Avoid

- Anemic domain models with all rules in services.
- Repositories returning loosely shaped data with domain logic scattered elsewhere.
- Generic manager or util classes replacing real domain concepts.
- Sharing one model across unrelated bounded contexts.
- Adding event-driven complexity without a concrete business need.
- Letting pages or design-system components infer business invariants from raw backend fields.
