import { genericOAuthClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

function getTrimmedEnvValue(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function getScopes(): string[] {
	const configuredScopes = getTrimmedEnvValue(
		import.meta.env.VITE_BETTER_AUTH_SCOPES,
	);

	if (!configuredScopes) {
		return ["openid", "profile", "email"];
	}

	return configuredScopes
		.split(",")
		.map((scope) => scope.trim())
		.filter((scope) => scope.length > 0);
}

export const betterAuthUrl = getTrimmedEnvValue(
	import.meta.env.VITE_BETTER_AUTH_URL,
);
export const keycloakProviderId =
	getTrimmedEnvValue(import.meta.env.VITE_BETTER_AUTH_KEYCLOAK_PROVIDER_ID) ??
	"keycloak";
export const keycloakScopes = getScopes();
export const authSuccessPath =
	getTrimmedEnvValue(import.meta.env.VITE_BETTER_AUTH_SUCCESS_PATH) ?? "/";
export const authErrorPath =
	getTrimmedEnvValue(import.meta.env.VITE_BETTER_AUTH_ERROR_PATH) ?? "/login";

export const authClient = createAuthClient({
	baseURL: betterAuthUrl,
	plugins: [genericOAuthClient()],
});
