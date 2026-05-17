// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	CurrentUserAuthError,
	currentUserQueryOptions,
	getCurrentUser,
} from "#/api/client";

describe("current-user client", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		window.sessionStorage.clear();
	});

	it("uses the stored access token and VITE_API_BASE_URL", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test/");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "test-access-token" }),
		);

		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({ id: "123", first_name: "John", last_name: "Doe" }),
				{
					headers: { "content-type": "application/json" },
					status: 200,
				},
			),
		);

		vi.stubGlobal("fetch", fetchSpy);

		await expect(getCurrentUser()).resolves.toEqual({
			id: "123",
			first_name: "John",
			last_name: "Doe",
		});

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(fetchSpy).toHaveBeenCalledWith(
			"https://api.example.test/users/me",
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Bearer test-access-token",
				}),
				method: "GET",
			}),
		);
	});

	it("fails before network execution when no access token is available", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		const fetchSpy = vi.fn<typeof fetch>();

		vi.stubGlobal("fetch", fetchSpy);

		await expect(getCurrentUser()).rejects.toMatchObject({
			message: "Missing authenticated session access token.",
			name: "CurrentUserAuthError",
		});
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("fails before network execution when browser storage is unavailable", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		const fetchSpy = vi.fn<typeof fetch>();

		vi.stubGlobal("fetch", fetchSpy);
		vi.stubGlobal("window", undefined);

		await expect(getCurrentUser()).rejects.toBeInstanceOf(CurrentUserAuthError);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("exposes a stable current-user query key", () => {
		expect(currentUserQueryOptions().queryKey).toEqual(["users", "me"]);
	});
});
