# Frontend Guidelines

## Overview

These guidelines apply to work under `client/`, a React 19 + Vite 7 + TanStack Router app using TypeScript, Vitest, Tailwind CSS v4, and Biome.

## Commands

- Install dependencies: `bun install`
- Start dev server: `bun --bun run dev`
- Build production bundle: `bun --bun run build`
- Preview production build: `bun --bun run preview`
- Run full test suite: `bun --bun run test`
- Format files with Biome: `bun --bun run format`
- Lint with Biome: `bun --bun run lint`
- Run formatter and linter checks: `bun --bun run check`

## Structure

- Route files live in `client/src/routes/` and use TanStack Router file-based routing.
- Shared UI lives in `client/src/components/`.
- Global styles and design tokens live in `client/src/styles.css`.
- `client/src/routeTree.gen.ts` is generated; do not hand-edit it.
- `client/src/main.tsx` and `client/src/router.tsx` show the router registration pattern.

## Formatting And Imports

- Biome is the source of truth for formatting and import organization.
- Biome is configured for tab indentation and double quotes in JavaScript and TypeScript.
- Let Biome organize imports instead of manually reordering them after every edit.
- Keep external imports before local imports.
- Remove unused imports in the same change that makes them unused.
- Relative imports are common for nearby files; path aliases `#/*` and `@/*` are available for `src/` if a relative path gets noisy.

## TypeScript

- `tsconfig.json` is strict; keep code compatible with `strict`, `noUnusedLocals`, and `noUnusedParameters`.
- Prefer explicit types on exported helpers, reusable hooks, and non-trivial utility functions.
- Prefer narrow unions such as `"light" | "dark" | "auto"` over `string` when values are constrained.
- Avoid `any`; use concrete types, generics, or `unknown` with narrowing.
- Non-null assertions are acceptable only when the DOM or framework contract makes them obvious, as in `document.getElementById("app")!`.
- Guard browser-only APIs with `typeof window !== "undefined"` when code may run during SSR or hydration.

## Components And Routes

- Components and type aliases use `PascalCase`.
- Variables, functions, and props use `camelCase`.
- Route modules export `Route` via `createFileRoute(...)` or `createRootRoute(...)`.
- Keep route filenames simple and lowercase to match URL structure, for example `about.tsx` and `index.tsx`.
- Prefer small function components and small route modules over large multi-purpose files.

## Styling

- Use Tailwind utility classes for component-level styling.
- Keep shared visual tokens in `client/src/styles.css` using CSS custom properties.
- Preserve the existing token-driven design approach instead of scattering hard-coded colors everywhere.
- Keep layouts responsive; the current UI already uses mobile and `sm:` breakpoints as the baseline.
- If you introduce new global styles, keep them aligned with the existing typography, gradients, and motion language.

## Error Handling

- Prefer defensive guards around `window`, `document`, `matchMedia`, and `localStorage`.
- Clean up subscriptions and event listeners in `useEffect` return callbacks.
- Do not swallow async errors silently; surface them through route-level handling, user-facing state, or logging.
- Prefer explicit fallback UI over hidden failure when adding data fetching.
