import { createFileRoute } from "@tanstack/react-router";

import { ProjectsPage } from "#/domains/workspace/ui/ProjectsPage";

export const Route = createFileRoute("/")({ component: ProjectsPage });
