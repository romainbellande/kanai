import { createFileRoute } from "@tanstack/react-router";

import { ProjectBoardPage } from "#/domains/workspace/ui/ProjectBoardPage";

type ProjectSearch = {
	view?: "history";
};

export const Route = createFileRoute("/projects/$projectId")({
	validateSearch: (search): ProjectSearch => ({
		view: search.view === "history" ? search.view : undefined,
	}),
	component: ProjectBoardPage,
});
