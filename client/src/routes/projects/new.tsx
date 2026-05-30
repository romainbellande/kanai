import { createFileRoute } from "@tanstack/react-router";

import { CreateProjectPage } from "#/domains/workspace/ui/CreateProjectPage";

export const Route = createFileRoute("/projects/new")({
	component: CreateProjectPage,
});
