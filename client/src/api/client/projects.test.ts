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
	closeActiveProjectSprint,
	createProject,
	createProjectColumn,
	createProjectSprint,
	deleteProjectColumn,
	getActiveProjectSprint,
	getActiveProjectSprintCloseConfirmation,
	getProject,
	getProjectDashboard,
	getProjectDoneColumn,
	listProjectColumns,
	listProjectSprintHistory,
	listProjects,
	projectActiveSprintQueryOptions,
	projectColumnsQueryOptions,
	projectDashboardQueryOptions,
	projectDoneColumnQueryOptions,
	projectQueryOptions,
	projectSprintHistoryQueryOptions,
	projectsQueryOptions,
	reorderProjectColumns,
	updateActiveProjectSprint,
	updateProject,
	updateProjectColumn,
	updateProjectDoneColumn,
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

	it("gets a project dashboard by API ID", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "project-token" }),
		);
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					project_id: "project-1",
					generated_at: "2026-06-22T10:00:00Z",
					charts: [
						{
							key: "burndown-chart",
							title: "Burndown chart",
							series: [],
							entries: [],
							empty_state: {
								reason: "no_project_task_change_events",
								message: "Waiting for Sprint Scope and completion events.",
							},
						},
					],
				}),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		await expect(getProjectDashboard("project-1")).resolves.toMatchObject({
			projectId: "project-1",
			charts: [
				{
					title: "Burndown chart",
					emptyState: { reason: "no_project_task_change_events" },
				},
			],
		});
		expect(projectDashboardQueryOptions("project-1").queryKey).toEqual([
			"projects",
			"project-1",
			"dashboard",
		]);
		expect(fetchSpy.mock.calls[0][0]).toBe(
			"https://api.example.test/projects/project-1/dashboard",
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
					description: "Notes",
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

		await createProject({
			name: "Created Project",
			code: "CRT",
			status: "active",
			description: "Notes",
		});

		const [url, init] = fetchSpy.mock.calls[0];

		expect(url).toBe("https://api.example.test/projects");
		expect(init?.method).toBe("POST");
		expect(JSON.parse(String(init?.body))).toEqual({
			name: "Created Project",
			code: "CRT",
			status: "active",
			description: "Notes",
		});
	});

	it("updates project metadata and preserves explicit null descriptions", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "project-token" }),
		);
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: "project-1",
					name: "Renamed Project",
					code: "API",
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

		await updateProject("project-1", {
			name: "Renamed Project",
			description: null,
		});

		const [url, init] = fetchSpy.mock.calls[0];

		expect(url).toBe("https://api.example.test/projects/project-1");
		expect(init?.method).toBe("PATCH");
		expect(JSON.parse(String(init?.body))).toEqual({
			name: "Renamed Project",
			description: null,
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
		expect(projectActiveSprintQueryOptions("project-1").queryKey).toEqual([
			"projects",
			"project-1",
			"sprints",
			"active",
		]);
		expect(projectDoneColumnQueryOptions("project-1").queryKey).toEqual([
			"projects",
			"project-1",
			"done-column",
		]);
		expect(projectSprintHistoryQueryOptions("project-1").queryKey).toEqual([
			"projects",
			"project-1",
			"sprints",
			"history",
		]);
	});

	it("gets and creates active project sprints through nested project endpoints", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test/");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "sprint-token" }),
		);
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						id: "sprint-1",
						project_id: "project-1",
						name: "Sprint 1",
						lifecycle_state: "active",
						planned_start_date: "2026-06-01",
						planned_end_date: "2026-06-14",
						goal: null,
						closed_at: null,
						created_at: null,
						updated_at: null,
					}),
					{ headers: { "content-type": "application/json" }, status: 200 },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						id: "sprint-1",
						project_id: "project-1",
						name: "Sprint 1",
						lifecycle_state: "active",
						planned_start_date: "2026-06-01",
						planned_end_date: "2026-06-14",
						goal: "Planning goal",
						closed_at: null,
						created_at: null,
						updated_at: null,
					}),
					{ headers: { "content-type": "application/json" }, status: 201 },
				),
			);
		vi.stubGlobal("fetch", fetchSpy);

		await expect(getActiveProjectSprint("project-1")).resolves.toMatchObject({
			id: "sprint-1",
			projectId: "project-1",
			name: "Sprint 1",
			lifecycleState: "active",
			plannedStartDate: "2026-06-01",
			plannedEndDate: "2026-06-14",
			goal: null,
		});
		await expect(
			createProjectSprint("project-1", {
				plannedStartDate: "2026-06-01",
				plannedEndDate: "2026-06-14",
				goal: "Planning goal",
				taskIds: ["task-1", "task-2"],
			}),
		).resolves.toMatchObject({
			name: "Sprint 1",
			goal: "Planning goal",
		});

		expect(fetchSpy.mock.calls[0][0]).toBe(
			"https://api.example.test/projects/project-1/sprints/active",
		);
		expect(fetchSpy.mock.calls[0][1]?.method).toBe("GET");
		expect(fetchSpy.mock.calls[1][0]).toBe(
			"https://api.example.test/projects/project-1/sprints",
		);
		expect(fetchSpy.mock.calls[1][1]?.method).toBe("POST");
		expect(JSON.parse(String(fetchSpy.mock.calls[1][1]?.body))).toEqual({
			planned_start_date: "2026-06-01",
			planned_end_date: "2026-06-14",
			goal: "Planning goal",
			task_ids: ["task-1", "task-2"],
		});
	});

	it("updates active project sprint metadata through the active sprint endpoint", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test/");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "sprint-token" }),
		);
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: "sprint-1",
					project_id: "project-1",
					name: "Sprint 1",
					lifecycle_state: "active",
					planned_start_date: "2026-06-02",
					planned_end_date: "2026-06-15",
					goal: null,
					closed_at: null,
					created_at: null,
					updated_at: null,
				}),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		await expect(
			updateActiveProjectSprint("project-1", {
				plannedStartDate: "2026-06-02",
				plannedEndDate: "2026-06-15",
				goal: null,
			}),
		).resolves.toMatchObject({
			name: "Sprint 1",
			plannedStartDate: "2026-06-02",
			plannedEndDate: "2026-06-15",
			goal: null,
		});

		expect(fetchSpy.mock.calls[0][0]).toBe(
			"https://api.example.test/projects/project-1/sprints/active",
		);
		expect(fetchSpy.mock.calls[0][1]?.method).toBe("PATCH");
		expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({
			planned_start_date: "2026-06-02",
			planned_end_date: "2026-06-15",
			goal: null,
		});
	});

	it("loads close confirmation and closes active project sprints", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test/");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "sprint-token" }),
		);
		const sprintJson = {
			id: "sprint-1",
			project_id: "project-1",
			name: "Sprint 1",
			lifecycle_state: "active",
			planned_start_date: "2026-06-01",
			planned_end_date: "2026-06-14",
			goal: null,
			closed_at: null,
			created_at: null,
			updated_at: null,
		};
		const taskJson = {
			id: "task-1",
			project_id: "project-1",
			sprint_id: "sprint-1",
			title: "Unfinished task",
			column_id: "column-todo",
			priority: null,
			story_points: 8,
			rank: "U",
			backlog_rank: null,
			assignee_id: null,
			description: null,
			acceptance_criteria: null,
			tag: null,
			created_at: null,
			updated_at: null,
		};
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						sprint: sprintJson,
						finished_count: 1,
						unfinished_count: 1,
						unfinished_tasks: [taskJson],
						carryover_statement:
							"Unfinished tasks will move to the top of the Backlog.",
					}),
					{ headers: { "content-type": "application/json" }, status: 200 },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						sprint: {
							...sprintJson,
							lifecycle_state: "closed",
							closed_at: "2026-06-09T20:00:00Z",
						},
						finished_count: 1,
						unfinished_count: 1,
						unfinished_tasks: [
							{ ...taskJson, sprint_id: null, backlog_rank: "!" },
						],
						carryover_statement:
							"Unfinished tasks will move to the top of the Backlog.",
						snapshots: [
							{
								id: "snapshot-1",
								sprint_id: "sprint-1",
								task_id: "task-1",
								column_id: "column-todo",
								title: "Unfinished task",
								outcome: "unfinished",
								priority: null,
								story_points: 8,
								rank: "U",
								description: null,
								acceptance_criteria: null,
								tag: null,
								created_at: null,
							},
						],
					}),
					{ headers: { "content-type": "application/json" }, status: 200 },
				),
			);
		vi.stubGlobal("fetch", fetchSpy);

		await expect(
			getActiveProjectSprintCloseConfirmation("project-1"),
		).resolves.toMatchObject({
			finishedCount: 1,
			unfinishedCount: 1,
			unfinishedTasks: [expect.objectContaining({ title: "Unfinished task" })],
		});
		await expect(closeActiveProjectSprint("project-1")).resolves.toMatchObject({
			sprint: { lifecycleState: "closed" },
			snapshots: [
				expect.objectContaining({ outcome: "unfinished", storyPoints: 8 }),
			],
		});
		expect(fetchSpy.mock.calls[0][0]).toBe(
			"https://api.example.test/projects/project-1/sprints/active/close-confirmation",
		);
		expect(fetchSpy.mock.calls[1][0]).toBe(
			"https://api.example.test/projects/project-1/sprints/active/close",
		);
		expect(fetchSpy.mock.calls[1][1]?.method).toBe("POST");
	});

	it("maps sprint history snapshots with historical Story Points", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test/");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "history-token" }),
		);
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify([
					{
						sprint: {
							id: "sprint-1",
							project_id: "project-1",
							name: "Sprint 1",
							lifecycle_state: "closed",
							planned_start_date: "2026-06-01",
							planned_end_date: "2026-06-14",
							goal: null,
							closed_at: "2026-06-09T20:00:00Z",
							created_at: null,
							updated_at: null,
						},
						finished_count: 1,
						unfinished_count: 1,
						unfinished_tasks: [],
						carryover_statement:
							"Unfinished tasks will move to the top of the Backlog.",
						snapshots: [
							{
								id: "snapshot-finished",
								sprint_id: "sprint-1",
								task_id: "finished-task",
								column_id: "column-done",
								title: "Finished close-time title",
								outcome: "finished",
								priority: null,
								story_points: 5,
								rank: "U",
								description: null,
								acceptance_criteria: null,
								tag: null,
								live_task_exists: true,
								created_at: null,
							},
							{
								id: "snapshot-unestimated",
								sprint_id: "sprint-1",
								task_id: "unestimated-task",
								column_id: "column-todo",
								title: "Unestimated close-time title",
								outcome: "unfinished",
								priority: null,
								story_points: null,
								rank: "V",
								description: null,
								acceptance_criteria: null,
								tag: null,
								live_task_exists: false,
								created_at: null,
							},
						],
					},
				]),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		await expect(listProjectSprintHistory("project-1")).resolves.toMatchObject([
			{
				snapshots: [
					expect.objectContaining({ storyPoints: 5, liveTaskExists: true }),
					expect.objectContaining({ storyPoints: null, liveTaskExists: false }),
				],
			},
		]);
		expect(fetchSpy.mock.calls[0][0]).toBe(
			"https://api.example.test/projects/project-1/sprints/history",
		);
	});

	it("gets and updates project Done Column configuration", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test/");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "done-token" }),
		);
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						project_id: "project-1",
						done_column_id: null,
						requires_designation: true,
					}),
					{ headers: { "content-type": "application/json" }, status: 200 },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						project_id: "project-1",
						done_column_id: "column-done",
						requires_designation: false,
					}),
					{ headers: { "content-type": "application/json" }, status: 200 },
				),
			);
		vi.stubGlobal("fetch", fetchSpy);

		await expect(getProjectDoneColumn("project-1")).resolves.toEqual({
			projectId: "project-1",
			doneColumnId: null,
			requiresDesignation: true,
		});
		await expect(
			updateProjectDoneColumn("project-1", { doneColumnId: "column-done" }),
		).resolves.toEqual({
			projectId: "project-1",
			doneColumnId: "column-done",
			requiresDesignation: false,
		});

		expect(fetchSpy.mock.calls[0][0]).toBe(
			"https://api.example.test/projects/project-1/done-column",
		);
		expect(fetchSpy.mock.calls[0][1]?.method).toBe("GET");
		expect(fetchSpy.mock.calls[1][0]).toBe(
			"https://api.example.test/projects/project-1/done-column",
		);
		expect(fetchSpy.mock.calls[1][1]?.method).toBe("PATCH");
		expect(JSON.parse(String(fetchSpy.mock.calls[1][1]?.body))).toEqual({
			done_column_id: "column-done",
		});
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
						description: "Ready to start",
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
				description: "Ready to start",
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
			description: "Needs QA",
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

		await createProjectColumn("project-1", {
			name: "Review",
			description: "Needs QA",
		});
		await updateProjectColumn("project-1", "column-1", {
			name: "QA",
			description: null,
		});
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
			description: "Needs QA",
		});
		expect(JSON.parse(String(fetchSpy.mock.calls[1][1]?.body))).toEqual({
			name: "QA",
			description: null,
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
			description: "Needs QA",
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
