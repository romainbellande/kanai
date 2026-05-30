import { createFileRoute } from "@tanstack/react-router";

import { CreateTaskPage } from "#/domains/workspace/ui/CreateTaskPage";

export const Route = createFileRoute("/projects_/$projectId/tasks/new")({
	component: CreateTaskPage,
});
