import { createFileRoute } from "@tanstack/react-router";

import { ProjectDashboardPage } from "#/domains/workspace/ui/ProjectDashboardPage";

export const Route = createFileRoute("/projects_/$projectId/dashboard")({
	component: ProjectDashboardRoute,
});

function ProjectDashboardRoute() {
	const { projectId } = Route.useParams();

	return <ProjectDashboardPage projectId={projectId} />;
}
