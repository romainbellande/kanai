import { Configuration } from "#/api/openapi-client";
import { createAuthBoundary } from "#/domains/auth/model/auth-boundary";

const missingAccessTokenErrorMessage =
	"Missing authenticated session access token.";

export class CurrentUserAuthError extends Error {
	constructor(message = missingAccessTokenErrorMessage) {
		super(message);
		this.name = "CurrentUserAuthError";
	}
}

type AuthenticatedRequestInit = RequestInit & {
	kanaiAuthRetried?: true;
};

export function getApiBaseUrl(): string {
	const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

	if (!apiBaseUrl) {
		throw new Error("Missing VITE_API_BASE_URL.");
	}

	return apiBaseUrl.replace(/\/+$/, "");
}

export async function getAccessToken(): Promise<string> {
	try {
		return await createAuthBoundary().accessToken();
	} catch {
		throw new CurrentUserAuthError();
	}
}

async function refreshAccessToken(): Promise<string> {
	try {
		return await createAuthBoundary().refreshAccessToken();
	} catch {
		throw new CurrentUserAuthError();
	}
}

export async function fetchAuthenticatedApi(
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	const token = await getAccessToken();
	const headers = new Headers(init.headers);

	headers.set("Authorization", `Bearer ${token}`);

	const response = await fetch(`${getApiBaseUrl()}${path}`, {
		...init,
		headers,
	});

	if (response.status !== 401) {
		return response;
	}

	const refreshedToken = await refreshAccessToken();
	const retryHeaders = new Headers(init.headers);

	retryHeaders.set("Authorization", `Bearer ${refreshedToken}`);

	return fetch(`${getApiBaseUrl()}${path}`, {
		...init,
		headers: retryHeaders,
	});
}

export function createAuthenticatedConfiguration(): Configuration {
	return new Configuration({
		basePath: getApiBaseUrl(),
		accessToken: getAccessToken,
		middleware: [
			{
				pre: async ({ init, url }) => {
					const token = await getAccessToken();
					const headers = new Headers(init.headers);

					headers.set("Authorization", `Bearer ${token}`);

					return {
						url,
						init: {
							...init,
							headers,
						},
					};
				},
				post: async ({ fetch, init, response, url }) => {
					const requestInit = init as AuthenticatedRequestInit;
					const headers = new Headers(init.headers);

					if (response.status !== 401 || requestInit.kanaiAuthRetried) {
						return response;
					}

					const token = await refreshAccessToken();
					headers.set("Authorization", `Bearer ${token}`);

					return fetch(url, {
						...init,
						headers,
						kanaiAuthRetried: true,
					} as AuthenticatedRequestInit);
				},
			},
		],
	});
}
