// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	type AuthBoundaryAdapters,
	createAuthBoundary,
} from "#/domains/auth/model/auth-boundary";

function buildAdapters(
	overrides: Partial<AuthBoundaryAdapters> = {},
): AuthBoundaryAdapters {
	return {
		clearSession: vi.fn(),
		completeCallback: vi.fn(),
		getLogoutUrl: vi.fn(() => "https://auth.example.test/logout"),
		getSession: vi.fn(() => null),
		hasActiveSession: vi.fn(() => false),
		isBypassPath: vi.fn((pathname) => pathname === "/login"),
		login: vi.fn(),
		...overrides,
	};
}

describe("auth boundary", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		window.sessionStorage.clear();
		window.history.replaceState(null, "", "/");
	});

	it("reports anonymous status and starts login for required pages", async () => {
		window.history.replaceState(null, "", "/projects/123?tab=board#tasks");
		const adapters = buildAdapters();
		const auth = createAuthBoundary(adapters);

		expect(auth.status).toBe("anonymous");
		await auth.requirePage("/projects/123?tab=board#tasks");

		expect(adapters.login).toHaveBeenCalledWith(
			window.location.origin,
			"/projects/123?tab=board#tasks",
		);
	});

	it("exposes bypass path decisions", () => {
		const auth = createAuthBoundary(buildAdapters());

		expect(auth.isBypassPath("/login")).toBe(true);
		expect(auth.isBypassPath("/projects/123")).toBe(false);
	});

	it("returns a trimmed access token for an active session", async () => {
		const auth = createAuthBoundary(
			buildAdapters({
				getSession: vi.fn(() => ({ accessToken: " api-token \t" })),
				hasActiveSession: vi.fn(() => true),
			}),
		);

		expect(auth.status).toBe("authenticated");
		await expect(auth.accessToken()).resolves.toBe("api-token");
	});

	it("fails token lookup when no session token is available", async () => {
		const auth = createAuthBoundary(buildAdapters());

		await expect(auth.accessToken()).rejects.toMatchObject({
			message: "Missing authenticated session access token.",
			name: "AuthBoundaryAccessTokenError",
		});
	});

	it("clears expired stored sessions before token lookup succeeds", async () => {
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({
				accessToken: "expired-token",
				expiresAt: Date.now() - 1_000,
			}),
		);

		const auth = createAuthBoundary();

		expect(auth.status).toBe("anonymous");
		await expect(auth.accessToken()).rejects.toMatchObject({
			message: "Missing authenticated session access token.",
		});
		expect(
			window.sessionStorage.getItem("kanai.openid-client.auth-session"),
		).toBeNull();
	});

	it("delegates callback completion and surfaces failures", async () => {
		const successAdapters = buildAdapters({ completeCallback: vi.fn() });
		await expect(
			createAuthBoundary(successAdapters).completeCallback(),
		).resolves.toBeUndefined();
		expect(successAdapters.completeCallback).toHaveBeenCalledTimes(1);

		const failure = new Error("callback failed");
		const failureAdapters = buildAdapters({
			completeCallback: vi.fn().mockRejectedValue(failure),
		});

		await expect(
			createAuthBoundary(failureAdapters).completeCallback(),
		).rejects.toBe(failure);
	});

	it("clears the session and redirects on logout", () => {
		const assign = vi.fn();
		vi.stubGlobal("location", { ...window.location, assign });
		const adapters = buildAdapters();

		createAuthBoundary(adapters).logout();

		expect(adapters.clearSession).toHaveBeenCalledTimes(1);
		expect(assign).toHaveBeenCalledWith("https://auth.example.test/logout");
	});
});
