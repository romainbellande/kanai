import { createFileRoute } from "@tanstack/react-router";

import { ProjectBoardPage } from "#/domains/workspace/ui/ProjectBoardPage";

export const Route = createFileRoute("/projects/$projectId")({
	component: ProjectBoardPage,
});
