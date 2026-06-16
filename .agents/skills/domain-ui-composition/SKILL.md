---
name: domain-ui-composition
description: Use when a feature combines domain-driven design with atomic UI composition, mapping business states into modular frontend components.
---

# Domain UI Composition

Use this meta-skill when a task needs both domain-driven design and atomic design in the same feature.

This skill tells the agent to load and apply:
- `ddd`
- `atomic-design`

## Goal

Coordinate domain modeling and UI composition so business rules stay in the right layer and the UI stays modular, reusable, and aligned with domain language.

## Use This Skill When

- A feature includes both business rules and UI changes.
- A route or screen needs to reflect domain states, permissions, or workflows.
- You are designing or refactoring a user flow with meaningful domain concepts.
- The task requires both better domain boundaries and better component structure.
- The UI currently leaks persistence details or contains business logic.

## Load These Skills Together

1. Load `ddd` to define bounded contexts, concepts, invariants, and use cases.
2. Load `atomic-design` to organize the resulting presentation into atoms, molecules, organisms, templates, and pages.

## Shared Layering Rule

Apply this boundary consistently:

1. Domain layer: business concepts, invariants, lifecycle rules.
2. Application layer: use-case orchestration and translation into UI-facing state.
3. UI layer: atomic components and route pages that render the translated state.

Short version:
- `ddd` defines meaning.
- `atomic-design` defines presentation structure.
- Application code connects them.

## Working Process

1. Identify the bounded context and the business capability being changed.
2. Extract the domain language used by the feature.
3. Define the key rules, states, and actions the UI must express.
4. Decide what should be computed before rendering versus what is purely presentational.
5. Map the UI into atomic levels:
   - atoms for primitives
   - molecules for small action/display groups
   - organisms for sections
   - templates for layouts
   - pages for route composition
6. Keep route configuration, loaders, and app wiring in `src/routes`.
7. Pass domain-derived state into the atomic component tree through explicit props.
8. Verify both domain behavior and rendered UI states.

## Decision Rules

- If a rule must always hold true, it belongs in the domain model.
- If logic coordinates domain objects, repositories, or side effects, it belongs in the application layer.
- If logic decides layout, markup, or visual grouping, it belongs in the atomic UI layer.
- If a component needs complex business branching, move that branching up to the application or route boundary unless it is purely visual.
- If a feature is too small to justify extra layers, apply both skills lightly and keep the change minimal.

## Expected Outputs

When using this meta-skill, provide:

1. The bounded context being changed.
2. The relevant domain concepts and invariants.
3. The UI-facing states or actions exposed to the frontend.
4. The atomic level for each new or changed component.
5. Any application-layer mapping introduced between domain and UI.
6. The minimal code changes needed.
7. The checks run.

## Anti-Patterns To Avoid

- Putting aggregate invariants in React components.
- Passing raw transport or persistence models through the entire UI tree.
- Building reusable UI components that secretly encode business policy.
- Treating route files as the place for all domain and UI logic.
- Forcing full DDD or full atomic folderization when the feature does not need it.

## Project Notes

For this client app:
- Keep TanStack Router definitions in `src/routes`.
- Keep reusable UI in `src/components` and organize it incrementally.
- Preserve the current Tailwind and `src/styles.css` visual language unless the task asks for a redesign.
- Prefer domain-named props and view state over raw backend-shaped objects.
