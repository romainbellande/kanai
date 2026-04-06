function getTrimmedEnvValue(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

type ParsedAuthIssuer = {
	url: string;
	realm: string;
};

function getScopes(): string[] {
	const configuredScopes =
		getTrimmedEnvValue(import.meta.env.VITE_AUTH_SCOPES) ??
		getTrimmedEnvValue(import.meta.env.VITE_BETTER_AUTH_SCOPES);

	if (!configuredScopes) {
		return ["openid", "profile", "email"];
	}

	return configuredScopes
		.split(",")
		.map((scope) => scope.trim())
		.filter((scope) => scope.length > 0);
}

export const authIssuer = getTrimmedEnvValue(import.meta.env.VITE_AUTH_ISSUER);
export const authClientId = getTrimmedEnvValue(
	import.meta.env.VITE_AUTH_CLIENT_ID,
);
export const authScopes = getScopes();
export const authSuccessPath =
	getTrimmedEnvValue(import.meta.env.VITE_AUTH_SUCCESS_PATH) ??
	getTrimmedEnvValue(import.meta.env.VITE_BETTER_AUTH_SUCCESS_PATH) ??
	"/auth/callback";
export const authErrorPath =
	getTrimmedEnvValue(import.meta.env.VITE_AUTH_ERROR_PATH) ??
	getTrimmedEnvValue(import.meta.env.VITE_BETTER_AUTH_ERROR_PATH) ??
	"/login";

function parseAuthIssuer(issuer: string): ParsedAuthIssuer {
	const issuerUrl = new URL(issuer);
	const pathSegments = issuerUrl.pathname.split("/").filter(Boolean);
	const realmSegmentIndex = pathSegments.indexOf("realms");

	if (
		realmSegmentIndex === -1 ||
		realmSegmentIndex === pathSegments.length - 1
	) {
		throw new Error(
			"VITE_AUTH_ISSUER must include /realms/<realm> in the URL.",
		);
	}

	const realm = pathSegments[realmSegmentIndex + 1];
	const basePath = pathSegments.slice(0, realmSegmentIndex).join("/");
	const url = `${issuerUrl.origin}${basePath ? `/${basePath}` : ""}`;

	return { url, realm };
}

export function getAuthConfig(): ParsedAuthIssuer & {
	clientId: string;
} {
	if (!authIssuer) {
		throw new Error("Missing VITE_AUTH_ISSUER.");
	}

	if (!authClientId) {
		throw new Error("Missing VITE_AUTH_CLIENT_ID.");
	}

	return {
		...parseAuthIssuer(authIssuer),
		clientId: authClientId,
	};
}

export function getAuthRedirectUri(origin: string): string {
	return new URL(authSuccessPath, origin).toString();
}

export function getAuthLogoutUrl(origin: string): string {
	const { url, realm, clientId } = getAuthConfig();
	const logoutUrl = new URL(url);

	logoutUrl.pathname = `${logoutUrl.pathname.replace(/\/$/, "")}/realms/${realm}/protocol/openid-connect/logout`;
	logoutUrl.searchParams.set("client_id", clientId);
	logoutUrl.searchParams.set(
		"post_logout_redirect_uri",
		new URL("/", origin).toString(),
	);

	return logoutUrl.toString();
}

export const authRealm = authIssuer
	? parseAuthIssuer(authIssuer).realm
	: undefined;
export const authServerUrl = authIssuer
	? parseAuthIssuer(authIssuer).url
	: undefined;
