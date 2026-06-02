// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
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
		window.sessionStorage.clear();
	});

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

	it("rejects before fetch when the token is missing", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		const fetchSpy = vi.fn<typeof fetch>();
		vi.stubGlobal("fetch", fetchSpy);

		await expect(listProjects()).rejects.toBeInstanceOf(CurrentUserAuthError);
		expect(fetchSpy).not.toHaveBeenCalled();
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
});
