# Atomic Design For This Client Project

Use this skill when working on UI structure in this client app and you want components to be organized with atomic design without fighting the current React + TanStack Router + Tailwind setup.

This skill is designed to combine with `ddd` when the UI needs to reflect domain concepts, business rules, and application workflows.

## Goal

Apply atomic design pragmatically in this project so UI pieces are easier to reuse, test, and evolve. Keep route files focused on page composition and flow, while moving reusable visual building blocks into clearly named component layers.

When paired with DDD, atomic design should organize presentation around domain language without moving domain rules into components.

## Project Context

- Stack: React 19 + TypeScript + Vite.
- Routing: TanStack Router with file-based routes in `src/routes`.
- Styling: Tailwind CSS utilities plus shared CSS variables in `src/styles.css`.
- Existing reusable UI lives in `src/components`.
- Current examples include `Header.tsx`, `Footer.tsx`, and `ThemeToggle.tsx`.

## Use This Skill When

- A route file is getting too large because it mixes layout and small UI pieces.
- A visual pattern appears in more than one route.
- A component has multiple responsibilities and should be split by UI level.
- You need a predictable place for new reusable UI.
- The user asks for design-system-like structure or better component organization.
- A feature already has domain concepts and you need to present them cleanly in the UI.

## Combining With DDD

Use both skills together with this split of responsibility:

1. DDD defines business concepts, invariants, and use cases.
2. Application code maps those concepts into UI-facing state and actions.
3. Atomic design decides how the UI is decomposed into atoms, molecules, organisms, templates, and pages.

Practical rule:
- DDD gives names such as `Order`, `SubscriptionStatus`, or `AuthSession`.
- Atomic design turns those into UI pieces such as badges, action groups, headers, panels, and page shells.

The UI should speak the domain language, but it should not enforce the domain rules itself.

## Atomic Levels In This Project

### Atoms

Small, focused UI primitives with minimal business knowledge.

Examples for this app:
- theme toggle button
- icon button
- nav link wrapper
- branded badge or logo mark
- text label or section heading

Rules:
- Prefer atoms to be presentation-focused.
- Keep props narrow and intention-revealing.
- Avoid coupling atoms directly to route loaders or auth flows.
- Prefer domain-aware prop names when useful, such as `status`, `isExpired`, or `canRetry`, as long as the atom stays presentation-focused.

### Molecules

Small combinations of atoms that solve a single interface task.

Examples for this app:
- auth action group
- social links cluster
- top-nav link list
- theme switcher control with label

Rules:
- Molecules may know a little about interaction flow.
- Keep them reusable across pages when possible.
- Do not let them become page sections.
- Accept UI-ready decisions from application code instead of recomputing domain policy internally.

### Organisms

Distinct sections of a page composed from atoms and molecules.

Examples for this app:
- site header
- site footer
- login hero
- auth callback status panel

Rules:
- Organisms can compose multiple concerns visually.
- They may depend on app-specific behavior.
- Keep data fetching and route orchestration out unless there is a strong reason.
- Organisms are a good place to render domain-driven states, as long as the decision logic was computed before rendering.

### Templates

Reusable page structures that arrange organisms and define page rhythm.

Examples for this app:
- marketing page shell
- authenticated app shell
- centered auth page layout

Rules:
- Templates describe structure, spacing, and slots.
- In this codebase, templates usually belong in `src/components/templates` or a nearby route-specific folder if only one route uses them.

### Pages

Route files in `src/routes` are pages.

Rules:
- Keep route files responsible for routing, loader/action wiring, metadata, and page composition.
- Prefer pages to import organisms and templates instead of holding long blocks of markup.
- TanStack route definitions should stay in the route file even if the rendered UI is extracted.
- Pages can select which organisms to render for a domain state, but should avoid embedding domain rules beyond light composition decisions.

## Recommended Structure

Use atomic design incrementally. Do not force a full rewrite of `src/components` up front.

When adding or refactoring UI, prefer this structure:

- `src/components/atoms`
- `src/components/molecules`
- `src/components/organisms`
- `src/components/templates`

Keep route-only components close to the route when reuse is unlikely.

Examples:
- `src/components/organisms/Header.tsx`
- `src/components/atoms/ThemeToggle.tsx`
- `src/components/molecules/SocialLinks.tsx`
- `src/routes/login/-components/LoginHero.tsx`

If the current flat `src/components` layout is still small, move files only when touching them for a real feature. Prefer gradual migration over churn.

## Mapping Existing Components

Use these as working defaults for this project:

- `Header.tsx`: organism
- `Footer.tsx`: organism
- `ThemeToggle.tsx`: atom, unless it grows labels, menus, or compound interactions

If `Header` contains separable parts like nav links, logout actions, or external links, extract them into molecules before changing page-level structure.

When those parts depend on business state, derive the needed flags and labels before they reach the extracted component.

## Working Process

1. Identify whether the requested UI change belongs at atom, molecule, organism, template, or page level.
2. If the feature is domain-driven, identify the domain terms and user-visible states first.
3. Check whether an existing component already covers the need.
4. Extract only the repeated or overloaded part.
5. Keep route concerns in `src/routes` and reusable UI in `src/components`.
6. Preserve existing Tailwind and CSS variable patterns from `src/styles.css`.
7. Verify the result on both desktop and mobile.
8. Run the relevant project checks after the change.

## Decision Rules

- If a component is a single interactive primitive, start at atom level.
- If it combines a few primitives into one clear job, make it a molecule.
- If it defines a major page section, make it an organism.
- If it mainly arranges sections and slots, make it a template.
- If it owns TanStack route configuration, it stays a page.
- If a component is deciding business validity, permission, or lifecycle rules, that logic likely belongs outside the atomic component hierarchy.

## Implementation Guidance

- Preserve the existing visual language unless the task asks for redesign.
- Keep Tailwind utility usage local to components; only move to shared CSS when a pattern is truly repeated.
- Prefer explicit prop names over generic `data` objects.
- Avoid passing large route objects deep into atoms and molecules.
- Keep auth logic in route or app logic layers, then pass only the UI state needed by components.
- When extracting components, keep file names aligned with the atomic level and actual responsibility.
- Prefer props shaped around domain meaning over raw transport fields when the feature is domain-driven.
- Do not let atoms, molecules, or organisms call repositories or encode aggregate invariants.
- If a page depends on domain/application services, resolve that first, then pass the result into the atomic component tree.

## Testing Guidance

Prioritize tests like this:

1. Behavior-heavy atoms and molecules.
2. Organisms with meaningful conditional rendering.
3. Route-level integration when composition or auth flow is involved.
4. Domain-to-UI mapping when presentation changes based on business state.

For this project, use Vitest and Testing Library. Test visible behavior and accessible interactions rather than Tailwind class names unless styling behavior itself is the feature.

## Output Expectations

When using this skill, provide:

1. The atomic level of each new or changed component.
2. Why that level fits the current project structure.
3. Which domain concepts or UI-facing states the component represents.
4. Whether the change is reusable across routes or route-local.
5. Any incremental migration performed in `src/components`.
6. The checks run, such as `bun --bun run test`, `bun --bun run check`, or `bun --bun run build` when relevant.

## Anti-Patterns To Avoid

- Forcing every component into atomic folders before there is a real need.
- Treating route files as generic component containers.
- Building oversized organisms that hide several unrelated concerns.
- Putting auth, routing, and data-loading logic inside atoms.
- Creating templates for one-off layouts with no reuse value.
- Renaming or moving components purely for theory without improving clarity.
- Encoding business invariants directly in atoms, molecules, or organisms.
- Passing raw repository or transport models through the whole UI tree when a smaller domain-facing shape would be clearer.
