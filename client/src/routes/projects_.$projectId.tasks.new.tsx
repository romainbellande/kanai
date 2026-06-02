import { createFileRoute } from "@tanstack/react-router";

import { CreateTaskPage } from "#/domains/workspace/ui/CreateTaskPage";

type CreateTaskSearch = {
	status?: string;
	column_id?: string;
};

export const Route = createFileRoute("/projects_/$projectId/tasks/new")({
	validateSearch: (search): CreateTaskSearch => ({
		status: typeof search.status === "string" ? search.status : undefined,
		column_id:
			typeof search.column_id === "string" ? search.column_id : undefined,
	}),
	component: CreateTaskRoute,
});

function CreateTaskRoute() {
	const { status } = Route.useSearch();
	return <CreateTaskPage initialStatus={status} />;
}
