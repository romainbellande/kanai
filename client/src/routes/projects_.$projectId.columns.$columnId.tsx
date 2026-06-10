import { createFileRoute } from "@tanstack/react-router";

import { ColumnDetailPage } from "#/domains/workspace/ui/ColumnDetailPage";

export const Route = createFileRoute("/projects_/$projectId/columns/$columnId")(
	{
		component: ColumnDetailPage,
	},
);
