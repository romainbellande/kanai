import { createFileRoute } from "@tanstack/react-router";

import { ProjectBoardContent } from "#/domains/workspace/ui/ProjectBoardPage";

export const Route = createFileRoute("/projects_/$projectId/backlog")({
	component: ProjectBacklogRoute,
});

function ProjectBacklogRoute() {
	const { projectId } = Route.useParams();

	return <ProjectBoardContent projectId={projectId} view="backlog" />;
}
