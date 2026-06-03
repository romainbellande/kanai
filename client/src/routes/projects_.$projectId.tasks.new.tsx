import { createFileRoute } from "@tanstack/react-router";

import { CreateTaskPage } from "#/domains/workspace/ui/CreateTaskPage";

type CreateTaskSearch = {
	column_id?: string;
};

export const Route = createFileRoute("/projects_/$projectId/tasks/new")({
	validateSearch: (search): CreateTaskSearch => ({
		column_id:
			typeof search.column_id === "string" ? search.column_id : undefined,
	}),
	component: CreateTaskRoute,
});

function CreateTaskRoute() {
	const { column_id: initialColumnId } = Route.useSearch();
	return <CreateTaskPage initialColumnId={initialColumnId} />;
}
