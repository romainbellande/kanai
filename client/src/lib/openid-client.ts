import * as client from "openid-client";

import {
	authErrorPath,
	authSuccessPath,
	getKeycloakRedirectUri,
	keycloakClientId,
	keycloakIssuer,
	keycloakScopes,
} from "#/lib/auth-client";

type PendingAuthorizationRequest = {
	codeVerifier: string;
	state: string;
	nonce: string;
	redirectUri: string;
};

const pendingAuthorizationRequestStorageKey =
	"kanai.openid-client.pending-authorization-request";

let openIdConfigurationPromise: Promise<client.Configuration> | null = null;

function isLoopbackHost(hostname: string): boolean {
	return (
		hostname === "localhost" ||
		hostname === "127.0.0.1" ||
		hostname === "[::1]" ||
		hostname === "::1"
	);
}

function shouldAllowInsecureRequests(issuer: string): boolean {
	const issuerUrl = new URL(issuer);

	return (
		import.meta.env.DEV &&
		issuerUrl.protocol === "http:" &&
		isLoopbackHost(issuerUrl.hostname)
	);
}

function getOpenIdClientConfig(): {
	clientId: string;
	issuer: string;
} {
	if (!keycloakIssuer) {
		throw new Error("Missing VITE_KEYCLOAK_ISSUER.");
	}

	if (!keycloakClientId) {
		throw new Error("Missing VITE_KEYCLOAK_CLIENT_ID.");
	}

	return {
		clientId: keycloakClientId,
		issuer: keycloakIssuer,
	};
}

async function getOpenIdConfiguration(): Promise<client.Configuration> {
	if (!openIdConfigurationPromise) {
		const { clientId, issuer } = getOpenIdClientConfig();
		openIdConfigurationPromise = client.discovery(
			new URL(issuer),
			clientId,
			{ token_endpoint_auth_method: "none" },
			client.None(),
			shouldAllowInsecureRequests(issuer)
				? { execute: [client.allowInsecureRequests] }
				: undefined,
		);
	}

	return openIdConfigurationPromise;
}

function getCallbackPath(origin: string): string {
	return new URL(authSuccessPath, origin).pathname;
}

function replaceBrowserLocation(url: URL): void {
	window.history.replaceState(
		window.history.state,
		"",
		`${url.pathname}${url.search}${url.hash}`,
	);
}

function buildAuthErrorUrl(origin: string, reason: string): URL {
	const url = new URL(authErrorPath, origin);
	url.searchParams.set("reason", reason);
	return url;
}

function readPendingAuthorizationRequest(): PendingAuthorizationRequest | null {
	if (typeof window === "undefined") {
		return null;
	}

	const serializedRequest = window.sessionStorage.getItem(
		pendingAuthorizationRequestStorageKey,
	);

	if (!serializedRequest) {
		return null;
	}

	try {
		const parsedRequest = JSON.parse(
			serializedRequest,
		) as Partial<PendingAuthorizationRequest>;

		if (
			typeof parsedRequest.codeVerifier !== "string" ||
			typeof parsedRequest.nonce !== "string" ||
			typeof parsedRequest.redirectUri !== "string" ||
			typeof parsedRequest.state !== "string"
		) {
			return null;
		}

		return {
			codeVerifier: parsedRequest.codeVerifier,
			nonce: parsedRequest.nonce,
			redirectUri: parsedRequest.redirectUri,
			state: parsedRequest.state,
		};
	} catch {
		return null;
	}
}

function writePendingAuthorizationRequest(
	request: PendingAuthorizationRequest,
): void {
	window.sessionStorage.setItem(
		pendingAuthorizationRequestStorageKey,
		JSON.stringify(request),
	);
}

function clearPendingAuthorizationRequest(): void {
	if (typeof window === "undefined") {
		return;
	}

	window.sessionStorage.removeItem(pendingAuthorizationRequestStorageKey);
}

function isAuthorizationCallback(url: URL): boolean {
	return (
		url.pathname === getCallbackPath(url.origin) &&
		(url.searchParams.has("code") || url.searchParams.has("error"))
	);
}

export async function initOpenIdClient(): Promise<void> {
	if (typeof window === "undefined") {
		return;
	}

	const currentUrl = new URL(window.location.href);

	if (!isAuthorizationCallback(currentUrl)) {
		return;
	}

	if (currentUrl.searchParams.has("error")) {
		const reason =
			currentUrl.searchParams.get("error_description") ??
			currentUrl.searchParams.get("error") ??
			"Could not finish the Keycloak sign-in flow.";

		clearPendingAuthorizationRequest();
		replaceBrowserLocation(buildAuthErrorUrl(currentUrl.origin, reason));
		return;
	}

	const pendingAuthorizationRequest = readPendingAuthorizationRequest();

	if (!pendingAuthorizationRequest) {
		replaceBrowserLocation(
			buildAuthErrorUrl(
				currentUrl.origin,
				"Missing PKCE verifier in session storage. Start the sign-in flow again.",
			),
		);
		return;
	}

	const configuration = await getOpenIdConfiguration();

	await client.authorizationCodeGrant(configuration, currentUrl, {
		expectedNonce: pendingAuthorizationRequest.nonce,
		expectedState: pendingAuthorizationRequest.state,
		idTokenExpected: true,
		pkceCodeVerifier: pendingAuthorizationRequest.codeVerifier,
	});

	clearPendingAuthorizationRequest();
	replaceBrowserLocation(new URL("/", currentUrl.origin));
}

export async function loginWithOpenIdClient(origin: string): Promise<void> {
	const configuration = await getOpenIdConfiguration();
	const redirectUri = getKeycloakRedirectUri(origin);
	const codeVerifier = client.randomPKCECodeVerifier();
	const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
	const state = client.randomState();
	const nonce = client.randomNonce();

	writePendingAuthorizationRequest({
		codeVerifier,
		nonce,
		redirectUri,
		state,
	});

	const authorizationUrl = client.buildAuthorizationUrl(configuration, {
		code_challenge: codeChallenge,
		code_challenge_method: "S256",
		nonce,
		redirect_uri: redirectUri,
		scope: keycloakScopes.join(" "),
		state,
	});

	window.location.assign(authorizationUrl.href);
}
