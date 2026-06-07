// @vitest-environment jsdom

import * as client from "openid-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("openid-client", () => ({
	None: vi.fn(() => ({})),
	allowInsecureRequests: vi.fn(),
	discovery: vi.fn(async () => ({ issuer: "https://auth.example.test" })),
	refreshTokenGrant: vi.fn(),
}));

import {
	addProjectMember,
	CurrentUserAuthError,
	createProject,
	createProjectColumn,
	deleteProjectColumn,
	getProject,
	listProjectColumns,
	listProjects,
	projectColumnsQueryOptions,
	projectQueryOptions,
	projectsQueryOptions,
	reorderProjectColumns,
	updateProjectColumn,
} from "#/api/client";

describe("projects client", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		vi.stubEnv("VITE_AUTH_CLIENT_ID", "kanai-web");
		vi.stubEnv("VITE_AUTH_ISSUER", "https://auth.example.test/realms/kanai");
		window.sessionStorage.clear();
	});

	function buildTokenSet(
		overrides: Partial<client.TokenEndpointResponse> = {},
	): Awaited<ReturnType<typeof client.refreshTokenGrant>> {
		return {
			access_token: "refreshed-column-token",
			claims: vi.fn(() => undefined),
			expiresIn: vi.fn(() => 120),
			expires_in: 120,
			token_type: "bearer" as const,
			...overrides,
		} as unknown as Awaited<ReturnType<typeof client.refreshTokenGrant>>;
	}

	it("lists projects with the API base URL and stored bearer token", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test/");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "project-token" }),
		);

		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify([
					{
						id: "project-1",
						name: "API Project",
						code: "API",
						priority: "high",
						description: null,
						status: "active",
						owner_ids: [],
						member_ids: [],
						created_at: null,
						updated_at: null,
					},
				]),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		await expect(listProjects()).resolves.toMatchObject([
			{ id: "project-1", name: "API Project" },
		]);
		const [url, init] = fetchSpy.mock.calls[0];

		expect(url).toBe("https://api.example.test/projects");
		expect(init?.method).toBe("GET");
		expect(new Headers(init?.headers).get("Authorization")).toBe(
			"Bearer project-token",
		);
	});

	it("gets a project by API ID", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "project-token" }),
		);
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: "project-1",
					name: "API Project",
					code: "API",
					priority: "high",
					description: null,
					status: "active",
					owner_ids: [],
					member_ids: [],
					created_at: null,
					updated_at: null,
				}),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		await getProject("project-1");

		expect(fetchSpy.mock.calls[0][0]).toBe(
			"https://api.example.test/projects/project-1",
		);
		expect(fetchSpy.mock.calls[0][1]?.method).toBe("GET");
	});

	it("creates projects with schema-compatible JSON and no invented members", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "project-token" }),
		);
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: "project-1",
					name: "Created Project",
					code: "CRT",
					priority: "medium",
					description: "Notes",
					status: null,
					owner_ids: [],
					member_ids: [],
					created_at: null,
					updated_at: null,
				}),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		await createProject({
			name: "Created Project",
			code: "CRT",
			priority: "medium",
			description: "Notes",
		});

		const [url, init] = fetchSpy.mock.calls[0];

		expect(url).toBe("https://api.example.test/projects");
		expect(init?.method).toBe("POST");
		expect(JSON.parse(String(init?.body))).toEqual({
			name: "Created Project",
			code: "CRT",
			priority: "medium",
			description: "Notes",
		});
	});

	it("rejects before projects fetch when the token is missing", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		const fetchSpy = vi.fn<typeof fetch>();
		vi.stubGlobal("fetch", fetchSpy);

		await expect(listProjects()).rejects.toBeInstanceOf(CurrentUserAuthError);
		expect(
			fetchSpy.mock.calls.some(
				([url]) => url === "https://api.example.test/projects",
			),
		).toBe(false);
	});

	it("exposes stable query keys", () => {
		expect(projectsQueryOptions().queryKey).toEqual(["projects"]);
		expect(projectQueryOptions("project-1").queryKey).toEqual([
			"projects",
			"project-1",
		]);
		expect(projectColumnsQueryOptions("project-1").queryKey).toEqual([
			"projects",
			"project-1",
			"columns",
		]);
	});

	it("lists project columns with the API base URL and stored bearer token", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test/");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "column-token" }),
		);
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify([
					{
						id: "column-1",
						project_id: "project-1",
						name: "To Do",
						position: 0,
						created_at: null,
						updated_at: null,
					},
				]),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		await expect(listProjectColumns("project-1")).resolves.toEqual([
			{
				id: "column-1",
				projectId: "project-1",
				name: "To Do",
				position: 0,
				createdAt: null,
				updatedAt: null,
			},
		]);
		expect(fetchSpy).toHaveBeenCalledWith(
			"https://api.example.test/projects/project-1/columns",
			expect.objectContaining({ method: "GET" }),
		);
		expect(
			new Headers(fetchSpy.mock.calls[0][1]?.headers).get("Authorization"),
		).toBe("Bearer column-token");
	});

	it("writes project columns through nested project endpoints", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "column-token" }),
		);
		const columnJson = {
			id: "column-1",
			project_id: "project-1",
			name: "Review",
			position: 3,
			created_at: null,
			updated_at: null,
		};
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(JSON.stringify(columnJson), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify(columnJson), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify([columnJson]), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			)
			.mockResolvedValueOnce(new Response(null, { status: 204 }));
		vi.stubGlobal("fetch", fetchSpy);

		await createProjectColumn("project-1", { name: "Review" });
		await updateProjectColumn("project-1", "column-1", { name: "QA" });
		await reorderProjectColumns("project-1", {
			columnIds: ["column-2", "column-1"],
		});
		await deleteProjectColumn("project-1", "column-1");

		expect(
			fetchSpy.mock.calls.map(([url, init]) => [url, init?.method]),
		).toEqual([
			["https://api.example.test/projects/project-1/columns", "POST"],
			["https://api.example.test/projects/project-1/columns/column-1", "PATCH"],
			["https://api.example.test/projects/project-1/columns/reorder", "PUT"],
			[
				"https://api.example.test/projects/project-1/columns/column-1",
				"DELETE",
			],
		]);
		expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({
			name: "Review",
		});
		expect(JSON.parse(String(fetchSpy.mock.calls[1][1]?.body))).toEqual({
			name: "QA",
		});
		expect(JSON.parse(String(fetchSpy.mock.calls[2][1]?.body))).toEqual({
			column_ids: ["column-2", "column-1"],
		});
	});

	it("refreshes and retries custom project column requests once after a 401", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({
				accessToken: "stale-column-token",
				expiresAt: Date.now() + 120_000,
				refreshToken: "column-refresh-token",
			}),
		);
		vi.mocked(client.refreshTokenGrant).mockResolvedValue(buildTokenSet());
		const columnJson = {
			id: "column-1",
			project_id: "project-1",
			name: "Review",
			position: 3,
			created_at: null,
			updated_at: null,
		};
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(new Response(null, { status: 401 }))
			.mockResolvedValueOnce(
				new Response(JSON.stringify(columnJson), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			);
		vi.stubGlobal("fetch", fetchSpy);

		await expect(
			updateProjectColumn("project-1", "column-1", { name: "Review" }),
		).resolves.toMatchObject({ id: "column-1", name: "Review" });

		expect(client.refreshTokenGrant).toHaveBeenCalledTimes(1);
		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(
			new Headers(fetchSpy.mock.calls[0][1]?.headers).get("Authorization"),
		).toBe("Bearer stale-column-token");
		expect(
			new Headers(fetchSpy.mock.calls[1][1]?.headers).get("Authorization"),
		).toBe("Bearer refreshed-column-token");
		expect(JSON.parse(String(fetchSpy.mock.calls[1][1]?.body))).toEqual({
			name: "Review",
		});
	});

	it("adds project members through the nested members endpoint", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "member-token" }),
		);
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: "project-1",
					name: "API Project",
					code: "API",
					priority: "high",
					description: null,
					status: "active",
					owner_ids: ["owner-1"],
					member_ids: ["member-1"],
					created_at: null,
					updated_at: null,
				}),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		await addProjectMember("project-1", "member-1");

		expect(fetchSpy.mock.calls[0][0]).toBe(
			"https://api.example.test/projects/project-1/members",
		);
		expect(fetchSpy.mock.calls[0][1]?.method).toBe("POST");
		expect(
			new Headers(fetchSpy.mock.calls[0][1]?.headers).get("Authorization"),
		).toBe("Bearer member-token");
		expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({
			user_id: "member-1",
		});
	});
});
