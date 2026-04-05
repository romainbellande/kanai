function getTrimmedEnvValue(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

type ParsedKeycloakIssuer = {
	url: string;
	realm: string;
};

function getScopes(): string[] {
	const configuredScopes =
		getTrimmedEnvValue(import.meta.env.VITE_KEYCLOAK_SCOPES) ??
		getTrimmedEnvValue(import.meta.env.VITE_BETTER_AUTH_SCOPES);

	if (!configuredScopes) {
		return ["openid", "profile", "email"];
	}

	return configuredScopes
		.split(",")
		.map((scope) => scope.trim())
		.filter((scope) => scope.length > 0);
}

export const keycloakIssuer = getTrimmedEnvValue(
	import.meta.env.VITE_KEYCLOAK_ISSUER,
);
export const keycloakClientId = getTrimmedEnvValue(
	import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
);
export const keycloakScopes = getScopes();
export const authSuccessPath =
	getTrimmedEnvValue(import.meta.env.VITE_KEYCLOAK_SUCCESS_PATH) ??
	getTrimmedEnvValue(import.meta.env.VITE_BETTER_AUTH_SUCCESS_PATH) ??
	"/auth/callback";
export const authErrorPath =
	getTrimmedEnvValue(import.meta.env.VITE_KEYCLOAK_ERROR_PATH) ??
	getTrimmedEnvValue(import.meta.env.VITE_BETTER_AUTH_ERROR_PATH) ??
	"/login";

function parseKeycloakIssuer(issuer: string): ParsedKeycloakIssuer {
	const issuerUrl = new URL(issuer);
	const pathSegments = issuerUrl.pathname.split("/").filter(Boolean);
	const realmSegmentIndex = pathSegments.indexOf("realms");

	if (
		realmSegmentIndex === -1 ||
		realmSegmentIndex === pathSegments.length - 1
	) {
		throw new Error(
			"VITE_KEYCLOAK_ISSUER must include /realms/<realm> in the URL.",
		);
	}

	const realm = pathSegments[realmSegmentIndex + 1];
	const basePath = pathSegments.slice(0, realmSegmentIndex).join("/");
	const url = `${issuerUrl.origin}${basePath ? `/${basePath}` : ""}`;

	return { url, realm };
}

export function getKeycloakConfig(): ParsedKeycloakIssuer & {
	clientId: string;
} {
	if (!keycloakIssuer) {
		throw new Error("Missing VITE_KEYCLOAK_ISSUER.");
	}

	if (!keycloakClientId) {
		throw new Error("Missing VITE_KEYCLOAK_CLIENT_ID.");
	}

	return {
		...parseKeycloakIssuer(keycloakIssuer),
		clientId: keycloakClientId,
	};
}

export function getKeycloakRedirectUri(origin: string): string {
	return new URL(authSuccessPath, origin).toString();
}

export function getKeycloakLogoutUrl(origin: string): string {
	const { url, realm, clientId } = getKeycloakConfig();
	const logoutUrl = new URL(url);

	logoutUrl.pathname = `${logoutUrl.pathname.replace(/\/$/, "")}/realms/${realm}/protocol/openid-connect/logout`;
	logoutUrl.searchParams.set("client_id", clientId);
	logoutUrl.searchParams.set(
		"post_logout_redirect_uri",
		new URL("/", origin).toString(),
	);

	return logoutUrl.toString();
}

export const keycloakRealm = keycloakIssuer
	? parseKeycloakIssuer(keycloakIssuer).realm
	: undefined;
export const keycloakServerUrl = keycloakIssuer
	? parseKeycloakIssuer(keycloakIssuer).url
	: undefined;
