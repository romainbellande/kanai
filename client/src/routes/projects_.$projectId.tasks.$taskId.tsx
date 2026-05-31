import { createFileRoute } from "@tanstack/react-router";

import { TaskDetailPage } from "#/domains/workspace/ui/TaskDetailPage";

export const Route = createFileRoute("/projects_/$projectId/tasks/$taskId")({
	component: TaskDetailPage,
});
