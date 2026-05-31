// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	CurrentUserAuthError,
	createProjectTask,
	listProjectTasks,
	projectTasksQueryOptions,
	updateProjectTask,
} from "#/api/client";

describe("tasks client", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		window.sessionStorage.clear();
	});

	it("lists project tasks with the API base URL and stored bearer token", async () => {
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
						status: "todo",
						priority: "high",
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

		await expect(listProjectTasks("project-1")).resolves.toMatchObject([
			{ id: "task-1", projectId: "project-1", title: "API Task", rank: "U" },
		]);
		const [url, init] = fetchSpy.mock.calls[0];

		expect(url).toBe("https://api.example.test/projects/project-1/tasks");
		expect(init?.method).toBe("GET");
		expect(new Headers(init?.headers).get("Authorization")).toBe(
			"Bearer task-token",
		);
	});

	it("creates tasks with schema-compatible JSON and no invented assignee", async () => {
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
					status: "todo",
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
				status: "todo",
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
			status: "todo",
			priority: "medium",
			description: "Notes",
			acceptance_criteria: "Done means shipped",
		});
	});

	it("updates task status and rank with schema-compatible JSON", async () => {
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
					status: "done",
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
			taskUpdate: { status: "done", rank: "j" },
		});

		const [url, init] = fetchSpy.mock.calls[0];

		expect(url).toBe(
			"https://api.example.test/projects/project-1/tasks/task-1",
		);
		expect(init?.method).toBe("PATCH");
		expect(JSON.parse(String(init?.body))).toEqual({
			status: "done",
			rank: "j",
		});
	});

	it("rejects before fetch when the token is missing", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		const fetchSpy = vi.fn<typeof fetch>();
		vi.stubGlobal("fetch", fetchSpy);

		await expect(listProjectTasks("project-1")).rejects.toBeInstanceOf(
			CurrentUserAuthError,
		);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("exposes a stable project tasks query key", () => {
		expect(projectTasksQueryOptions("project-1").queryKey).toEqual([
			"projects",
			"project-1",
			"tasks",
		]);
	});
});
