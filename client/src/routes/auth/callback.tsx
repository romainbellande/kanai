import { createFileRoute } from "@tanstack/react-router";

import { AuthCallbackPage } from "#/domains/auth/ui/AuthCallbackPage";

export const Route = createFileRoute("/auth/callback")({
	component: AuthCallbackPage,
});
