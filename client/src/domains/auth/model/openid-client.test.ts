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
		access_token: "new-access-token",
		claims: vi.fn(() => undefined),
		expiresIn: vi.fn(() => 120),
		expires_in: 120,
		token_type: "bearer" as const,
		...overrides,
	} as unknown as Awaited<ReturnType<typeof client.refreshTokenGrant>>;
}

async function importOpenIdClient() {
	vi.resetModules();
	vi.stubEnv("VITE_AUTH_CLIENT_ID", "kanai-web");
	vi.stubEnv("VITE_AUTH_ISSUER", "https://auth.example.test/realms/kanai");

	return import("#/domains/auth/model/openid-client");
}

describe("openid client session refresh", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.unstubAllEnvs();
		window.sessionStorage.clear();
	});

	it("stores refreshed access tokens and rotated refresh tokens", async () => {
		vi.mocked(client.refreshTokenGrant).mockResolvedValue(
			buildTokenSet({ refresh_token: "rotated-refresh-token" }),
		);
		window.sessionStorage.setItem(
			authSessionStorageKey,
			JSON.stringify({
				accessToken: "expired-access-token",
				expiresAt: Date.now() - 1_000,
				refreshToken: "old-refresh-token",
			}),
		);

		const { refreshStoredAuthSession } = await importOpenIdClient();
		const refreshedSession = await refreshStoredAuthSession();

		expect(refreshedSession.accessToken).toBe("new-access-token");
		expect(refreshedSession.refreshToken).toBe("rotated-refresh-token");
		expect(refreshedSession.expiresAt).toBeGreaterThan(Date.now());
		expect(client.refreshTokenGrant).toHaveBeenCalledWith(
			expect.anything(),
			"old-refresh-token",
			{ scope: "openid profile email" },
		);
		expect(
			JSON.parse(window.sessionStorage.getItem(authSessionStorageKey) ?? "{}"),
		).toMatchObject({
			accessToken: "new-access-token",
			refreshToken: "rotated-refresh-token",
		});
	});

	it("keeps the previous refresh token when refresh does not rotate it", async () => {
		vi.mocked(client.refreshTokenGrant).mockResolvedValue(buildTokenSet());
		window.sessionStorage.setItem(
			authSessionStorageKey,
			JSON.stringify({
				accessToken: "expired-access-token",
				refreshToken: "stable-refresh-token",
			}),
		);

		const { refreshStoredAuthSession } = await importOpenIdClient();
		const refreshedSession = await refreshStoredAuthSession();

		expect(refreshedSession.refreshToken).toBe("stable-refresh-token");
	});

	it("shares one in-flight refresh request between concurrent callers", async () => {
		vi.mocked(client.refreshTokenGrant).mockResolvedValue(buildTokenSet());
		window.sessionStorage.setItem(
			authSessionStorageKey,
			JSON.stringify({ refreshToken: "shared-refresh-token" }),
		);

		const { refreshStoredAuthSession } = await importOpenIdClient();
		const [firstSession, secondSession] = await Promise.all([
			refreshStoredAuthSession(),
			refreshStoredAuthSession(),
		]);

		expect(firstSession.accessToken).toBe("new-access-token");
		expect(secondSession.accessToken).toBe("new-access-token");
		expect(client.refreshTokenGrant).toHaveBeenCalledTimes(1);
	});

	it("clears stale session data when refresh fails", async () => {
		vi.mocked(client.refreshTokenGrant).mockRejectedValue(
			new Error("rejected"),
		);
		window.sessionStorage.setItem(
			authSessionStorageKey,
			JSON.stringify({ refreshToken: "rejected-refresh-token" }),
		);

		const { refreshStoredAuthSession } = await importOpenIdClient();

		await expect(refreshStoredAuthSession()).rejects.toThrow("rejected");
		expect(window.sessionStorage.getItem(authSessionStorageKey)).toBeNull();
	});
});
