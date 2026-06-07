// @vitest-environment jsdom

import * as client from "openid-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("openid-client", () => ({
	None: vi.fn(() => ({})),
	allowInsecureRequests: vi.fn(),
	discovery: vi.fn(async () => ({ issuer: "https://auth.example.test" })),
	refreshTokenGrant: vi.fn(),
}));

const authSessionStorageKey = "kanai.openid-client.auth-session";

function buildTokenSet(
	overrides: Partial<client.TokenEndpointResponse> = {},
): Awaited<ReturnType<typeof client.refreshTokenGrant>> {
	return {
		access_token: "refreshed-token",
		claims: vi.fn(() => undefined),
		expiresIn: vi.fn(() => 120),
		expires_in: 120,
		token_type: "bearer" as const,
		...overrides,
	} as unknown as Awaited<ReturnType<typeof client.refreshTokenGrant>>;
}

function userResponse(status = 200): Response {
	return new Response(
		JSON.stringify({
			id: "user-1",
		}),
		{ headers: { "content-type": "application/json" }, status },
	);
}

async function createUsersApi() {
	const [{ UsersApi }, { createAuthenticatedConfiguration }] =
		await Promise.all([import("#/api/openapi-client"), import("./utils")]);

	return new UsersApi(createAuthenticatedConfiguration());
}

async function callCurrentUser() {
	return (await createUsersApi()).getUsersMeUsersMeGet();
}

function storeAuthSession(session: {
	accessToken: string;
	expiresAt?: number;
	refreshToken?: string;
}) {
	window.sessionStorage.setItem(authSessionStorageKey, JSON.stringify(session));
}

describe("authenticated generated client configuration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		vi.stubEnv("VITE_AUTH_CLIENT_ID", "kanai-web");
		vi.stubEnv("VITE_AUTH_ISSUER", "https://auth.example.test/realms/kanai");
		window.sessionStorage.clear();
	});

	it("attaches bearer tokens to generated API requests", async () => {
		storeAuthSession({
			accessToken: "access-token",
			expiresAt: Date.now() + 120_000,
		});
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(userResponse());

		vi.stubGlobal("fetch", fetchSpy);

		await expect(callCurrentUser()).resolves.toMatchObject({
			id: "user-1",
		});

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(fetchSpy.mock.calls[0][0]).toBe("https://api.example.test/users/me");
		expect(
			new Headers(fetchSpy.mock.calls[0][1]?.headers).get("Authorization"),
		).toBe("Bearer access-token");
	});

	it("refreshes and retries a generated API request once after a 401", async () => {
		storeAuthSession({
			accessToken: "expired-token",
			expiresAt: Date.now() + 120_000,
			refreshToken: "refresh-token",
		});
		vi.mocked(client.refreshTokenGrant).mockResolvedValue(buildTokenSet());
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(new Response(null, { status: 401 }))
			.mockResolvedValueOnce(userResponse());

		vi.stubGlobal("fetch", fetchSpy);

		await expect(callCurrentUser()).resolves.toMatchObject({
			id: "user-1",
		});

		expect(client.refreshTokenGrant).toHaveBeenCalledTimes(1);
		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(
			new Headers(fetchSpy.mock.calls[0][1]?.headers).get("Authorization"),
		).toBe("Bearer expired-token");
		expect(
			new Headers(fetchSpy.mock.calls[1][1]?.headers).get("Authorization"),
		).toBe("Bearer refreshed-token");
	});

	it("does not retry indefinitely when the retried generated API request also returns 401", async () => {
		storeAuthSession({
			accessToken: "expired-token",
			expiresAt: Date.now() + 120_000,
			refreshToken: "refresh-token",
		});
		vi.mocked(client.refreshTokenGrant).mockResolvedValue(buildTokenSet());
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(new Response(null, { status: 401 }))
			.mockResolvedValueOnce(new Response(null, { status: 401 }));

		vi.stubGlobal("fetch", fetchSpy);

		await expect(callCurrentUser()).rejects.toMatchObject({
			name: "ResponseError",
		});
		expect(client.refreshTokenGrant).toHaveBeenCalledTimes(1);
		expect(fetchSpy).toHaveBeenCalledTimes(2);
	});

	it("leaves non-auth generated API failures on the normal request failure path", async () => {
		storeAuthSession({
			accessToken: "access-token",
			expiresAt: Date.now() + 120_000,
			refreshToken: "refresh-token",
		});
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response(null, { status: 500 }));

		vi.stubGlobal("fetch", fetchSpy);

		await expect(callCurrentUser()).rejects.toMatchObject({
			name: "ResponseError",
		});
		expect(client.refreshTokenGrant).not.toHaveBeenCalled();
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});
});
