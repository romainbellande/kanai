// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getUserDisplayLabel,
	getUserInitials,
	getUserProfiles,
	projectAccessUsersQueryKey,
	searchUsers,
	userSearchQueryOptions,
} from "#/api/client";

describe("users client", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		window.sessionStorage.clear();
	});

	it("fetches project access user profiles by user ID", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test/");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "user-token" }),
		);
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						display_name: "Jane Owner",
						external_id: "owner@example.test",
						first_name: null,
						id: "owner-1",
						last_name: null,
					}),
					{ headers: { "content-type": "application/json" }, status: 200 },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						display_name: null,
						external_id: "member@example.test",
						first_name: "Maya",
						id: "member-1",
						last_name: "Member",
					}),
					{ headers: { "content-type": "application/json" }, status: 200 },
				),
			);
		vi.stubGlobal("fetch", fetchSpy);

		await expect(getUserProfiles(["owner-1", "member-1"])).resolves.toEqual([
			{
				display_name: "Jane Owner",
				external_id: "owner@example.test",
				first_name: undefined,
				id: "owner-1",
				last_name: undefined,
			},
			{
				display_name: undefined,
				external_id: "member@example.test",
				first_name: "Maya",
				id: "member-1",
				last_name: "Member",
			},
		]);
		expect(
			fetchSpy.mock.calls.map(([url, init]) => [
				url,
				init?.method,
				new Headers(init?.headers).get("Authorization"),
			]),
		).toEqual([
			["https://api.example.test/users/owner-1", "GET", "Bearer user-token"],
			["https://api.example.test/users/member-1", "GET", "Bearer user-token"],
		]);
	});

	it("derives readable labels and stable project access query keys", () => {
		expect(
			projectAccessUsersQueryKey("project-1", ["member-1", "owner-1"]),
		).toEqual([
			"projects",
			"project-1",
			"access-users",
			["member-1", "owner-1"],
		]);
		expect(
			getUserDisplayLabel({
				display_name: "Jane Owner",
				external_id: "owner@example.test",
				id: "owner-1",
			}),
		).toBe("Jane Owner");
		expect(
			getUserDisplayLabel({
				external_id: "member@example.test",
				first_name: "Maya",
				id: "member-1",
				last_name: "Member",
			}),
		).toBe("Maya Member");
		expect(
			getUserInitials({
				display_name: "Jane Owner",
				external_id: "owner@example.test",
				id: "owner-1",
			}),
		).toBe("JO");
	});

	it("searches users with query text and a capped result limit", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test/");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "search-token" }),
		);
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify([
					{
						display_name: "Ada Lovelace",
						external_id: "ada-idp",
						first_name: null,
						id: "user-ada",
						last_name: null,
					},
				]),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		await expect(searchUsers("Ada", 20)).resolves.toEqual([
			{
				display_name: "Ada Lovelace",
				external_id: "ada-idp",
				first_name: undefined,
				id: "user-ada",
				last_name: undefined,
			},
		]);

		expect(fetchSpy).toHaveBeenCalledWith(
			"https://api.example.test/users?limit=20&q=Ada",
			expect.objectContaining({
				headers: { Authorization: "Bearer search-token" },
				method: "GET",
			}),
		);
		expect(userSearchQueryOptions("A", 20).enabled).toBe(false);
		expect(userSearchQueryOptions("Ada", 20).queryKey).toEqual([
			"users",
			"search",
			"Ada",
			20,
		]);
	});
});
