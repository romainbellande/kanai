# AGENTS

## Scope

These instructions apply to `client/src/domains/workspace/ui/`.

## Workspace UI Shape

- Keep TanStack route wiring in `client/src/routes/`; workspace page modules compose the route body.
- Keep `templates/WorkspaceLayout.tsx` as the shared shell for sidebar, header, page title, description, and breadcrumbs.
- Follow the existing atomic folders: `atoms/` for primitives, `molecules/` for small UI tasks, `organisms/` for page sections, and `templates/` for layout shells.
- Reuse workspace atoms and molecules before adding duplicate markup in organisms.
- Keep business rules and data shaping in `../model/` or page-level mapping; UI components should receive UI-ready props when practical.
