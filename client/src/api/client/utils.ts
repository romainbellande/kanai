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
			},
		],
	});
}
