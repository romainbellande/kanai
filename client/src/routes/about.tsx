import { createFileRoute } from "@tanstack/react-router";

import { AboutPage } from "#/domains/about/ui/AboutPage";

export const Route = createFileRoute("/about")({
	component: AboutPage,
});
