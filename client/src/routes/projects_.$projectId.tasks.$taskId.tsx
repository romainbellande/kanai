import { createFileRoute } from "@tanstack/react-router";

import { TaskDetailPage } from "#/domains/workspace/ui/TaskDetailPage";

type TaskDetailSearch = {
	backlog?: boolean;
};

export const Route = createFileRoute("/projects_/$projectId/tasks/$taskId")({
	validateSearch: (search): TaskDetailSearch => ({
		backlog: search.backlog === true || search.backlog === "true",
	}),
	component: TaskDetailRoute,
});

function TaskDetailRoute() {
	const { backlog: fromBacklog } = Route.useSearch();
	return <TaskDetailPage fromBacklog={fromBacklog} />;
}
