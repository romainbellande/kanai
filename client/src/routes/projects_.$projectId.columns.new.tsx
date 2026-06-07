import { createFileRoute } from "@tanstack/react-router";

import { CreateColumnPage } from "#/domains/workspace/ui/CreateColumnPage";

export const Route = createFileRoute("/projects_/$projectId/columns/new")({
	component: CreateColumnPage,
});
