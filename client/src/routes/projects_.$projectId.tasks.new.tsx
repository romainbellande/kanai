import { createFileRoute } from "@tanstack/react-router";

import { CreateTaskPage } from "#/domains/workspace/ui/CreateTaskPage";

type CreateTaskSearch = {
	column_id?: string;
	in_sprint?: boolean;
};

export const Route = createFileRoute("/projects_/$projectId/tasks/new")({
	validateSearch: (search): CreateTaskSearch => ({
		column_id:
			typeof search.column_id === "string" ? search.column_id : undefined,
		in_sprint: search.in_sprint === true || search.in_sprint === "true",
	}),
	component: CreateTaskRoute,
});

function CreateTaskRoute() {
	const { column_id: initialColumnId, in_sprint: includeInActiveSprint } =
		Route.useSearch();
	return (
		<CreateTaskPage
			initialColumnId={initialColumnId}
			includeInActiveSprint={includeInActiveSprint}
		/>
	);
}
