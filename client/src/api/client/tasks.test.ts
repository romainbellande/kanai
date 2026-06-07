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
	CurrentUserAuthError,
	createProjectTask,
	listProjectTasks,
	moveProjectTask,
	projectTasksQueryOptions,
	updateProjectTask,
} from "#/api/client";

describe("tasks client", () => {
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
			access_token: "refreshed-task-token",
			claims: vi.fn(() => undefined),
			expiresIn: vi.fn(() => 120),
			expires_in: 120,
			token_type: "bearer" as const,
			...overrides,
		} as unknown as Awaited<ReturnType<typeof client.refreshTokenGrant>>;
	}

	it("lists project tasks with the API base URL, stored bearer token, and column IDs", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test/");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "task-token" }),
		);

		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify([
					{
						id: "task-1",
						project_id: "project-1",
						title: "API Task",
						column_id: "column-todo",
						priority: "urgent",
						rank: "U",
						assignee_id: null,
						description: null,
						acceptance_criteria: null,
						tag: null,
						created_at: null,
						updated_at: null,
					},
				]),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		const tasks = await listProjectTasks("project-1");

		expect(tasks).toMatchObject([
			{
				id: "task-1",
				projectId: "project-1",
				title: "API Task",
				columnId: "column-todo",
				priority: "critical",
				rank: "U",
			},
		]);
		expect(tasks[0]).not.toHaveProperty("status");
		const [url, init] = fetchSpy.mock.calls[0];

		expect(url).toBe("https://api.example.test/projects/project-1/tasks");
		expect(init?.method).toBe("GET");
		expect(new Headers(init?.headers).get("Authorization")).toBe(
			"Bearer task-token",
		);
	});

	it("maps blank task priority responses to null", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test/");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "task-token" }),
		);
		vi.stubGlobal(
			"fetch",
			vi.fn<typeof fetch>().mockResolvedValue(
				new Response(
					JSON.stringify([
						{
							id: "task-1",
							project_id: "project-1",
							title: "API Task",
							column_id: "column-todo",
							priority: "",
							rank: "U",
							assignee_id: null,
							description: null,
							acceptance_criteria: null,
							tag: null,
							created_at: null,
							updated_at: null,
						},
					]),
					{ headers: { "content-type": "application/json" }, status: 200 },
				),
			),
		);

		await expect(listProjectTasks("project-1")).resolves.toMatchObject([
			{ priority: null },
		]);
	});

	it("creates tasks with column IDs and no legacy status payload", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "task-token" }),
		);
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: "task-1",
					project_id: "project-1",
					title: "Created Task",
					column_id: "column-todo",
					priority: "medium",
					rank: "U",
					assignee_id: null,
					description: "Notes",
					acceptance_criteria: "Done means shipped",
					tag: null,
					created_at: null,
					updated_at: null,
				}),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		await createProjectTask({
			projectId: "project-1",
			taskCreate: {
				title: "Created Task",
				columnId: "column-todo",
				priority: "medium",
				description: "Notes",
				acceptanceCriteria: "Done means shipped",
			},
		});

		const [url, init] = fetchSpy.mock.calls[0];

		expect(url).toBe("https://api.example.test/projects/project-1/tasks");
		expect(init?.method).toBe("POST");
		expect(JSON.parse(String(init?.body))).toEqual({
			title: "Created Task",
			column_id: "column-todo",
			priority: "medium",
			description: "Notes",
			acceptance_criteria: "Done means shipped",
		});
	});

	it("updates task fields without sending rank through PATCH", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "task-token" }),
		);
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: "task-1",
					project_id: "project-1",
					title: "Moved Task",
					column_id: "column-done",
					priority: "medium",
					rank: "j",
					assignee_id: null,
					description: null,
					acceptance_criteria: null,
					tag: null,
					created_at: null,
					updated_at: null,
				}),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		await updateProjectTask({
			projectId: "project-1",
			taskId: "task-1",
			taskUpdate: { priority: "low" },
		});

		const [url, init] = fetchSpy.mock.calls[0];

		expect(url).toBe(
			"https://api.example.test/projects/project-1/tasks/task-1",
		);
		expect(init?.method).toBe("PATCH");
		expect(JSON.parse(String(init?.body))).toEqual({
			priority: "low",
		});
	});

	it("moves tasks with destination neighbors and maps the moved response", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "task-token" }),
		);
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: "task-1",
					project_id: "project-1",
					title: "Moved Task",
					column_id: "column-done",
					priority: "medium",
					rank: "b",
					assignee_id: null,
					description: null,
					acceptance_criteria: null,
					tag: null,
					created_at: null,
					updated_at: null,
				}),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		const movedTask = await moveProjectTask({
			projectId: "project-1",
			taskId: "task-1",
			destination: {
				columnId: "column-done",
				beforeTaskId: "task-before",
				afterTaskId: "task-after",
			},
		});

		const [url, init] = fetchSpy.mock.calls[0];

		expect(movedTask).toMatchObject({
			id: "task-1",
			columnId: "column-done",
			rank: "b",
		});
		expect(url).toBe(
			"https://api.example.test/projects/project-1/tasks/task-1/move",
		);
		expect(init?.method).toBe("PUT");
		expect(JSON.parse(String(init?.body))).toEqual({
			column_id: "column-done",
			before_task_id: "task-before",
			after_task_id: "task-after",
		});
	});

	it("refreshes and retries custom task requests once after a 401", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({
				accessToken: "stale-task-token",
				expiresAt: Date.now() + 120_000,
				refreshToken: "task-refresh-token",
			}),
		);
		vi.mocked(client.refreshTokenGrant).mockResolvedValue(buildTokenSet());
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(new Response(null, { status: 401 }))
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						id: "task-1",
						project_id: "project-1",
						title: "Moved Task",
						column_id: "column-done",
						priority: "medium",
						rank: "b",
						assignee_id: null,
						description: null,
						acceptance_criteria: null,
						tag: null,
						created_at: null,
						updated_at: null,
					}),
					{ headers: { "content-type": "application/json" }, status: 200 },
				),
			);
		vi.stubGlobal("fetch", fetchSpy);

		await expect(
			moveProjectTask({
				projectId: "project-1",
				taskId: "task-1",
				destination: { columnId: "column-done" },
			}),
		).resolves.toMatchObject({ id: "task-1", columnId: "column-done" });

		expect(client.refreshTokenGrant).toHaveBeenCalledTimes(1);
		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(
			new Headers(fetchSpy.mock.calls[0][1]?.headers).get("Authorization"),
		).toBe("Bearer stale-task-token");
		expect(
			new Headers(fetchSpy.mock.calls[1][1]?.headers).get("Authorization"),
		).toBe("Bearer refreshed-task-token");
		expect(JSON.parse(String(fetchSpy.mock.calls[1][1]?.body))).toEqual({
			column_id: "column-done",
		});
	});

	it("leaves non-auth custom task move failures on the normal request failure path", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({
				accessToken: "task-token",
				expiresAt: Date.now() + 120_000,
				refreshToken: "task-refresh-token",
			}),
		);
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify({ detail: "failed" }), {
				status: 500,
			}),
		);
		vi.stubGlobal("fetch", fetchSpy);

		await expect(
			moveProjectTask({
				projectId: "project-1",
				taskId: "task-1",
				destination: { columnId: "column-done" },
			}),
		).rejects.toThrow("Project task request failed with 500.");

		expect(client.refreshTokenGrant).not.toHaveBeenCalled();
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});

	it("rejects before task fetch when the token is missing", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		const fetchSpy = vi.fn<typeof fetch>();
		vi.stubGlobal("fetch", fetchSpy);

		await expect(listProjectTasks("project-1")).rejects.toBeInstanceOf(
			CurrentUserAuthError,
		);
		expect(
			fetchSpy.mock.calls.some(
				([url]) => url === "https://api.example.test/projects/project-1/tasks",
			),
		).toBe(false);
	});

	it("exposes a stable project tasks query key", () => {
		expect(projectTasksQueryOptions("project-1").queryKey).toEqual([
			"projects",
			"project-1",
			"tasks",
		]);
	});
});
