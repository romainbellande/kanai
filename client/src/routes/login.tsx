import { createFileRoute } from "@tanstack/react-router";

import { LoginPage } from "#/domains/auth/ui/LoginPage";

type LoginSearch = {
	error?: string;
	message?: string;
	reason?: string;
};

export const Route = createFileRoute("/login")({
	validateSearch: (search): LoginSearch => ({
		error: typeof search.error === "string" ? search.error : undefined,
		message: typeof search.message === "string" ? search.message : undefined,
		reason: typeof search.reason === "string" ? search.reason : undefined,
	}),
	component: LoginRoute,
});

function LoginRoute() {
	const search = Route.useSearch();
	return <LoginPage {...search} />;
}
