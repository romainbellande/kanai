import * as client from "openid-client";

import {
	authClientId,
	authErrorPath,
	authIssuer,
	authScopes,
	authSuccessPath,
	getAuthRedirectUri,
} from "#/lib/auth-client";

type PendingAuthorizationRequest = {
	codeVerifier: string;
	state: string;
	nonce: string;
	redirectUri: string;
	returnToPath: string;
};

type StoredAuthSession = {
	accessToken?: string;
	expiresAt?: number;
	idToken?: string;
	refreshToken?: string;
};

const pendingAuthorizationRequestStorageKey =
	"kanai.openid-client.pending-authorization-request";
const authSessionStorageKey = "kanai.openid-client.auth-session";
const authSessionExpiryLeewayMs = 30_000;

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
	if (!authIssuer) {
		throw new Error("Missing VITE_AUTH_ISSUER.");
	}

	if (!authClientId) {
		throw new Error("Missing VITE_AUTH_CLIENT_ID.");
	}

	return {
		clientId: authClientId,
		issuer: authIssuer,
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

function getAuthErrorPath(origin: string): string {
	return new URL(authErrorPath, origin).pathname;
}

function getSafeReturnToPath(
	origin: string,
	returnToPath: string | undefined,
): string {
	if (!returnToPath?.startsWith("/")) {
		return "/";
	}

	const url = new URL(returnToPath, origin);
	return url.origin === origin
		? `${url.pathname}${url.search}${url.hash}`
		: "/";
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

function readStoredAuthSession(): StoredAuthSession | null {
	if (typeof window === "undefined") {
		return null;
	}

	const serializedSession = window.sessionStorage.getItem(
		authSessionStorageKey,
	);

	if (!serializedSession) {
		return null;
	}

	try {
		const parsedSession = JSON.parse(serializedSession) as StoredAuthSession;

		if (
			typeof parsedSession !== "object" ||
			parsedSession === null ||
			(parsedSession.accessToken !== undefined &&
				typeof parsedSession.accessToken !== "string") ||
			(parsedSession.expiresAt !== undefined &&
				typeof parsedSession.expiresAt !== "number") ||
			(parsedSession.idToken !== undefined &&
				typeof parsedSession.idToken !== "string") ||
			(parsedSession.refreshToken !== undefined &&
				typeof parsedSession.refreshToken !== "string")
		) {
			return null;
		}

		return parsedSession;
	} catch {
		return null;
	}
}

function writeStoredAuthSession(session: StoredAuthSession): void {
	window.sessionStorage.setItem(authSessionStorageKey, JSON.stringify(session));
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
			returnToPath: getSafeReturnToPath(
				window.location.origin,
				typeof parsedRequest.returnToPath === "string"
					? parsedRequest.returnToPath
					: undefined,
			),
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

export function clearAuthSession(): void {
	if (typeof window === "undefined") {
		return;
	}

	window.sessionStorage.removeItem(authSessionStorageKey);
}

export function hasActiveAuthSession(): boolean {
	const authSession = readStoredAuthSession();

	if (!authSession?.accessToken) {
		return false;
	}

	if (
		typeof authSession.expiresAt === "number" &&
		authSession.expiresAt <= Date.now() + authSessionExpiryLeewayMs
	) {
		clearAuthSession();
		return false;
	}

	return true;
}

export function getAuthErrorUrl(origin: string, reason: string): string {
	return buildAuthErrorUrl(origin, reason).toString();
}

export function isAuthenticationBypassPath(
	pathname: string,
	origin: string,
): boolean {
	return (
		pathname === getCallbackPath(origin) ||
		pathname === getAuthErrorPath(origin) ||
		pathname === "/login"
	);
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
			"Could not finish the sign-in flow.";

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

	const tokenSet = await client.authorizationCodeGrant(
		configuration,
		currentUrl,
		{
			expectedNonce: pendingAuthorizationRequest.nonce,
			expectedState: pendingAuthorizationRequest.state,
			idTokenExpected: true,
			pkceCodeVerifier: pendingAuthorizationRequest.codeVerifier,
		},
	);

	writeStoredAuthSession({
		accessToken: tokenSet.access_token,
		expiresAt:
			typeof tokenSet.expires_in === "number"
				? Date.now() + tokenSet.expires_in * 1000
				: undefined,
		idToken: tokenSet.id_token,
		refreshToken: tokenSet.refresh_token,
	});

	clearPendingAuthorizationRequest();
	replaceBrowserLocation(
		new URL(pendingAuthorizationRequest.returnToPath, currentUrl.origin),
	);
}

export async function loginWithOpenIdClient(
	origin: string,
	returnToPath = "/",
): Promise<void> {
	const configuration = await getOpenIdConfiguration();
	const redirectUri = getAuthRedirectUri(origin);
	const codeVerifier = client.randomPKCECodeVerifier();
	const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
	const state = client.randomState();
	const nonce = client.randomNonce();

	writePendingAuthorizationRequest({
		codeVerifier,
		nonce,
		redirectUri,
		returnToPath: getSafeReturnToPath(origin, returnToPath),
		state,
	});

	const authorizationUrl = client.buildAuthorizationUrl(configuration, {
		code_challenge: codeChallenge,
		code_challenge_method: "S256",
		nonce,
		redirect_uri: redirectUri,
		scope: authScopes.join(" "),
		state,
	});

	window.location.assign(authorizationUrl.href);
}
