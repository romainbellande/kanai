// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import * as client from "openid-client";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("openid-client", () => ({
	None: vi.fn(() => ({})),
	allowInsecureRequests: vi.fn(),
	buildAuthorizationUrl: vi.fn(
		() => new URL("https://auth.example.test/authorize"),
	),
	calculatePKCECodeChallenge: vi.fn(async () => "code-challenge"),
	discovery: vi.fn(async () => ({ issuer: "https://auth.example.test" })),
	randomNonce: vi.fn(() => "nonce"),
	randomPKCECodeVerifier: vi.fn(() => "code-verifier"),
	randomState: vi.fn(() => "state"),
	refreshTokenGrant: vi.fn(),
}));

import {
	type ProjectColumn,
	projectColumnsQueryOptions,
	projectTasksQueryOptions,
	type Task,
} from "#/api/client";
import {
	reorderProjectColumnsForMove,
	reorderProjectColumnsForPlacement,
	useProjectTaskBoard,
} from "#/domains/workspace/model/useProjectTaskBoard";

function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
			mutations: { retry: false },
		},
	});
}

function createWrapper(queryClient: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

function task(overrides: Partial<Task> = {}): Task {
	return {
		id: "task-1",
		projectId: "project-1",
		sprintId: null,
		backlogRank: null,
		title: "Task",
		columnId: "column-todo",
		priority: "medium",
		rank: "U",
		assigneeId: null,
		description: null,
		acceptanceCriteria: null,
		tag: null,
		createdAt: null,
		updatedAt: null,
		...overrides,
	};
}

function projectColumn(overrides: Partial<ProjectColumn> = {}): ProjectColumn {
	return {
		id: "column-todo",
		projectId: "project-1",
		name: "To Do",
		description: null,
		position: 0,
		createdAt: null,
		updatedAt: null,
		...overrides,
	};
}

function projectColumnJson(overrides: Partial<ProjectColumn> = {}) {
	const sourceColumn = projectColumn(overrides);

	return {
		id: sourceColumn.id,
		project_id: sourceColumn.projectId,
		name: sourceColumn.name,
		description: sourceColumn.description,
		position: sourceColumn.position,
		created_at: sourceColumn.createdAt?.toISOString() ?? null,
		updated_at: sourceColumn.updatedAt?.toISOString() ?? null,
	};
}

function projectColumnsResponse(columns: ProjectColumn[]) {
	return new Response(
		JSON.stringify(columns.map((column) => projectColumnJson(column))),
		{
			headers: { "content-type": "application/json" },
			status: 200,
		},
	);
}

function taskJson(overrides: Partial<Task> = {}) {
	const sourceTask = task(overrides);

	return {
		id: sourceTask.id,
		project_id: sourceTask.projectId,
		title: sourceTask.title,
		column_id: sourceTask.columnId,
		priority: sourceTask.priority,
		rank: sourceTask.rank,
		assignee_id: sourceTask.assigneeId,
		description: sourceTask.description,
		acceptance_criteria: sourceTask.acceptanceCriteria,
		tag: sourceTask.tag,
		created_at: sourceTask.createdAt?.toISOString() ?? null,
		updated_at: sourceTask.updatedAt?.toISOString() ?? null,
	};
}

function taskResponse(overrides: Partial<Task> = {}) {
	return new Response(JSON.stringify(taskJson(overrides)), {
		headers: { "content-type": "application/json" },
		status: 200,
	});
}

function tasksResponse(tasks: Task[]) {
	return new Response(JSON.stringify(tasks.map((item) => taskJson(item))), {
		headers: { "content-type": "application/json" },
		status: 200,
	});
}

function buildTokenSet(
	overrides: Partial<client.TokenEndpointResponse> = {},
): Awaited<ReturnType<typeof client.refreshTokenGrant>> {
	return {
		access_token: "refreshed-board-token",
		claims: vi.fn(() => undefined),
		expiresIn: vi.fn(() => 120),
		expires_in: 120,
		token_type: "bearer" as const,
		...overrides,
	} as unknown as Awaited<ReturnType<typeof client.refreshTokenGrant>>;
}

describe("useProjectTaskBoard", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		vi.stubEnv("VITE_AUTH_CLIENT_ID", "kanai-web");
		vi.stubEnv("VITE_AUTH_ISSUER", "https://auth.example.test/realms/kanai");
		window.sessionStorage.clear();
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "board-token" }),
		);
	});

	it("keeps optimistic movement visible during recovered auth retry", async () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			{
				id: "column-todo",
				projectId: "project-1",
				name: "To Do",
				description: null,
				position: 0,
				createdAt: null,
				updatedAt: null,
			},
			{
				id: "column-done",
				projectId: "project-1",
				name: "Done",
				description: null,
				position: 1,
				createdAt: null,
				updatedAt: null,
			},
		]);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({ id: "moved", columnId: "column-todo", rank: "U" }),
			task({ id: "done-first", columnId: "column-done", rank: "U" }),
		]);
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({
				accessToken: "stale-board-token",
				expiresAt: Date.now() + 120_000,
				refreshToken: "board-refresh-token",
			}),
		);
		let resolveRefresh: (
			value: Awaited<ReturnType<typeof client.refreshTokenGrant>>,
		) => void = () => undefined;
		const refreshPromise = new Promise<
			Awaited<ReturnType<typeof client.refreshTokenGrant>>
		>((resolve) => {
			resolveRefresh = resolve;
		});
		vi.mocked(client.refreshTokenGrant).mockReturnValue(refreshPromise);
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(new Response(null, { status: 401 }))
			.mockResolvedValueOnce(
				taskResponse({ id: "moved", columnId: "column-done", rank: "F" }),
			)
			.mockResolvedValue(
				tasksResponse([
					task({ id: "moved", columnId: "column-done", rank: "F" }),
					task({ id: "done-first", columnId: "column-done", rank: "U" }),
				]),
			);
		vi.stubGlobal("fetch", fetchSpy);

		const { result } = renderHook(() => useProjectTaskBoard("project-1"), {
			wrapper: createWrapper(queryClient),
		});

		act(() => {
			result.current.moveTask({
				taskId: "moved",
				toColumnId: "column-done",
				afterTaskId: "done-first",
			});
		});

		await waitFor(() =>
			expect(client.refreshTokenGrant).toHaveBeenCalledTimes(1),
		);
		expect(result.current.moveState.isMovePending).toBe(true);
		expect(result.current.moveState.moveError).toBeNull();
		expect(
			queryClient
				.getQueryData<Task[]>(projectTasksQueryOptions("project-1").queryKey)
				?.find((cachedTask) => cachedTask.id === "moved"),
		).toMatchObject({ columnId: "column-done", rank: "F" });

		act(() => {
			resolveRefresh(buildTokenSet());
		});

		await waitFor(() =>
			expect(result.current.moveState.isMovePending).toBe(false),
		);
		expect(result.current.moveState.moveError).toBeNull();
		expect(fetchSpy).toHaveBeenCalledWith(
			"https://api.example.test/projects/project-1/tasks/moved/move",
			expect.objectContaining({ method: "PUT" }),
		);
		expect(
			new Headers(fetchSpy.mock.calls[0][1]?.headers).get("Authorization"),
		).toBe("Bearer stale-board-token");
		expect(
			new Headers(fetchSpy.mock.calls[1][1]?.headers).get("Authorization"),
		).toBe("Bearer refreshed-board-token");
	});

	it("uses the refreshed token for post-move task refetches", async () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			{
				id: "column-todo",
				projectId: "project-1",
				name: "To Do",
				description: null,
				position: 0,
				createdAt: null,
				updatedAt: null,
			},
			{
				id: "column-done",
				projectId: "project-1",
				name: "Done",
				description: null,
				position: 1,
				createdAt: null,
				updatedAt: null,
			},
		]);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({ id: "moved", columnId: "column-todo", rank: "U" }),
			task({ id: "done-first", columnId: "column-done", rank: "U" }),
		]);
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({
				accessToken: "stale-board-token",
				expiresAt: Date.now() + 120_000,
				refreshToken: "board-refresh-token",
			}),
		);
		vi.mocked(client.refreshTokenGrant).mockResolvedValue(buildTokenSet());
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(new Response(null, { status: 401 }))
			.mockResolvedValueOnce(
				taskResponse({ id: "moved", columnId: "column-done", rank: "F" }),
			)
			.mockResolvedValue(
				tasksResponse([
					task({ id: "moved", columnId: "column-done", rank: "F" }),
					task({ id: "done-first", columnId: "column-done", rank: "U" }),
				]),
			);
		vi.stubGlobal("fetch", fetchSpy);

		const { result } = renderHook(() => useProjectTaskBoard("project-1"), {
			wrapper: createWrapper(queryClient),
		});

		act(() => {
			result.current.moveTask({
				taskId: "moved",
				toColumnId: "column-done",
				afterTaskId: "done-first",
			});
		});

		await waitFor(() =>
			expect(
				fetchSpy.mock.calls.some(
					([url, init]) =>
						url === "https://api.example.test/projects/project-1/tasks" &&
						init?.method === "GET" &&
						new Headers(init.headers).get("Authorization") ===
							"Bearer refreshed-board-token",
				),
			).toBe(true),
		);
		expect(result.current.moveState.moveError).toBeNull();
	});

	it("exposes grouped columns and drag state", () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			{
				id: "column-backlog",
				projectId: "project-1",
				name: "Backlog",
				description: "Ready for planning",
				position: 0,
				createdAt: null,
				updatedAt: null,
			},
			{
				id: "column-review",
				projectId: "project-1",
				name: "Review",
				description: null,
				position: 1,
				createdAt: null,
				updatedAt: null,
			},
		]);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({ id: "review-task", title: "Review", columnId: "column-review" }),
			task({
				id: "backlog-task",
				title: "Backlog",
				columnId: "column-backlog",
			}),
		]);

		const { result } = renderHook(() => useProjectTaskBoard("project-1"), {
			wrapper: createWrapper(queryClient),
		});

		expect(result.current.columns.map((column) => column.id)).toEqual([
			"column-backlog",
			"column-review",
		]);
		expect(result.current.columns.map((column) => column.title)).toEqual([
			"Backlog",
			"Review",
		]);
		expect(result.current.columns[0].cards.map((card) => card.id)).toEqual([
			"backlog-task",
		]);
		expect(result.current.columns[1].cards.map((card) => card.id)).toEqual([
			"review-task",
		]);

		act(() => {
			result.current.dragState.setDraggingTaskId("backlog-task");
			result.current.dragState.setActiveDropColumnId("column-review");
		});

		expect(result.current.dragState.draggingTaskId).toBe("backlog-task");
		expect(result.current.dragState.activeDropColumnId).toBe("column-review");
	});

	it("optimistically moves a task and invalidates after success", async () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			{
				id: "column-todo",
				projectId: "project-1",
				name: "To Do",
				description: null,
				position: 0,
				createdAt: null,
				updatedAt: null,
			},
			{
				id: "column-done",
				projectId: "project-1",
				name: "Done",
				description: null,
				position: 1,
				createdAt: null,
				updatedAt: null,
			},
		]);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({ id: "moved", columnId: "column-todo", rank: "U" }),
			task({ id: "done-first", columnId: "column-done", rank: "U" }),
		]);
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: "moved",
					project_id: "project-1",
					title: "Task",
					column_id: "column-done",
					priority: "medium",
					rank: "F",
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

		const { result } = renderHook(() => useProjectTaskBoard("project-1"), {
			wrapper: createWrapper(queryClient),
		});

		act(() => {
			result.current.moveTask({
				taskId: "moved",
				toColumnId: "column-done",
				afterTaskId: "done-first",
			});
		});

		expect(
			queryClient
				.getQueryData<Task[]>(projectTasksQueryOptions("project-1").queryKey)
				?.find((cachedTask) => cachedTask.id === "moved"),
		).toMatchObject({ columnId: "column-done", rank: "F" });

		await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
		const [url, init] = fetchSpy.mock.calls[0];
		expect(url).toBe(
			"https://api.example.test/projects/project-1/tasks/moved/move",
		);
		expect(init?.method).toBe("PUT");
		expect(JSON.parse(String(init?.body))).toEqual({
			column_id: "column-done",
			after_task_id: "done-first",
		});
		await waitFor(() =>
			expect(
				queryClient.getQueryState(
					projectTasksQueryOptions("project-1").queryKey,
				)?.isInvalidated,
			).toBe(true),
		);
	});

	it("rolls back optimistic movement on API failure", async () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			{
				id: "column-todo",
				projectId: "project-1",
				name: "To Do",
				description: null,
				position: 0,
				createdAt: null,
				updatedAt: null,
			},
			{
				id: "column-done",
				projectId: "project-1",
				name: "Done",
				description: null,
				position: 1,
				createdAt: null,
				updatedAt: null,
			},
		]);
		const originalTasks = [
			task({ id: "moved", columnId: "column-todo", rank: "U" }),
			task({ id: "done-first", columnId: "column-done", rank: "U" }),
		];
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			originalTasks,
		);
		vi.stubGlobal(
			"fetch",
			vi
				.fn<typeof fetch>()
				.mockResolvedValue(
					new Response(JSON.stringify({ detail: "failed" }), { status: 500 }),
				),
		);

		const { result } = renderHook(() => useProjectTaskBoard("project-1"), {
			wrapper: createWrapper(queryClient),
		});

		act(() => {
			result.current.moveTask({
				taskId: "moved",
				toColumnId: "column-done",
				afterTaskId: "done-first",
			});
		});

		await waitFor(() =>
			expect(
				queryClient.getQueryData(
					projectTasksQueryOptions("project-1").queryKey,
				),
			).toEqual(originalTasks),
		);
		expect(result.current.moveState.moveError).toBe(
			"Task move failed. Your board was restored.",
		);
	});

	it("rolls back optimistic movement when auth refresh cannot recover", async () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			{
				id: "column-todo",
				projectId: "project-1",
				name: "To Do",
				description: null,
				position: 0,
				createdAt: null,
				updatedAt: null,
			},
			{
				id: "column-done",
				projectId: "project-1",
				name: "Done",
				description: null,
				position: 1,
				createdAt: null,
				updatedAt: null,
			},
		]);
		const originalTasks = [
			task({ id: "moved", columnId: "column-todo", rank: "U" }),
			task({ id: "done-first", columnId: "column-done", rank: "U" }),
		];
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			originalTasks,
		);
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({
				accessToken: "stale-board-token",
				expiresAt: Date.now() + 120_000,
				refreshToken: "board-refresh-token",
			}),
		);
		vi.mocked(client.refreshTokenGrant).mockRejectedValue(
			new Error("refresh rejected"),
		);
		vi.stubGlobal(
			"fetch",
			vi
				.fn<typeof fetch>()
				.mockResolvedValue(new Response(null, { status: 401 })),
		);

		const { result } = renderHook(() => useProjectTaskBoard("project-1"), {
			wrapper: createWrapper(queryClient),
		});

		act(() => {
			result.current.moveTask({
				taskId: "moved",
				toColumnId: "column-done",
				afterTaskId: "done-first",
			});
		});

		await waitFor(() =>
			expect(
				queryClient.getQueryData(
					projectTasksQueryOptions("project-1").queryKey,
				),
			).toEqual(originalTasks),
		);
		expect(result.current.moveState.moveError).toBe(
			"Task move failed. Your board was restored.",
		);
		expect(client.refreshTokenGrant).toHaveBeenCalledTimes(1);
	});

	it("allows only one in-flight move", async () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			{
				id: "column-todo",
				projectId: "project-1",
				name: "To Do",
				description: null,
				position: 0,
				createdAt: null,
				updatedAt: null,
			},
			{
				id: "column-done",
				projectId: "project-1",
				name: "Done",
				description: null,
				position: 1,
				createdAt: null,
				updatedAt: null,
			},
		]);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({ id: "first", columnId: "column-todo", rank: "U" }),
			task({ id: "second", columnId: "column-todo", rank: "j" }),
			task({ id: "done-first", columnId: "column-done", rank: "U" }),
		]);
		let resolveMove: (response: Response) => void = () => undefined;
		const movePromise = new Promise<Response>((resolve) => {
			resolveMove = resolve;
		});
		const fetchSpy = vi.fn<typeof fetch>().mockReturnValue(movePromise);
		vi.stubGlobal("fetch", fetchSpy);

		const { result } = renderHook(() => useProjectTaskBoard("project-1"), {
			wrapper: createWrapper(queryClient),
		});

		act(() => {
			result.current.moveTask({
				taskId: "first",
				toColumnId: "column-done",
				afterTaskId: "done-first",
			});
			result.current.moveTask({
				taskId: "second",
				toColumnId: "column-done",
				afterTaskId: "done-first",
			});
		});

		expect(result.current.moveState.isMovePending).toBe(true);
		await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
		expect(
			queryClient
				.getQueryData<Task[]>(projectTasksQueryOptions("project-1").queryKey)
				?.find((cachedTask) => cachedTask.id === "second"),
		).toMatchObject({ columnId: "column-todo", rank: "j" });

		act(() => {
			resolveMove(
				new Response(
					JSON.stringify({
						id: "first",
						project_id: "project-1",
						title: "Task",
						column_id: "column-done",
						priority: "medium",
						rank: "F",
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
		});

		await waitFor(() =>
			expect(result.current.moveState.isMovePending).toBe(false),
		);
	});

	it("returns no reorder for missing columns and boundary moves", () => {
		const columns = [
			projectColumn({ id: "column-todo", name: "To Do", position: 0 }),
			projectColumn({ id: "column-done", name: "Done", position: 1 }),
		];

		expect(
			reorderProjectColumnsForMove(columns, {
				columnId: "missing-column",
				direction: "left",
			}),
		).toBeNull();
		expect(
			reorderProjectColumnsForMove(columns, {
				columnId: "column-todo",
				direction: "left",
			}),
		).toBeNull();
		expect(
			reorderProjectColumnsForMove(columns, {
				columnId: "column-done",
				direction: "right",
			}),
		).toBeNull();
	});

	it("computes column moves and refreshed positions", () => {
		const reordered = reorderProjectColumnsForMove(
			[
				projectColumn({ id: "column-todo", name: "To Do", position: 0 }),
				projectColumn({ id: "column-doing", name: "Doing", position: 1 }),
				projectColumn({ id: "column-done", name: "Done", position: 2 }),
			],
			{ columnId: "column-doing", direction: "right" },
		);

		expect(reordered?.map((column) => column.id)).toEqual([
			"column-todo",
			"column-done",
			"column-doing",
		]);
		expect(reordered?.map((column) => column.position)).toEqual([0, 1, 2]);
	});

	it("computes column placement reorders from before and after edges", () => {
		const columns = [
			projectColumn({ id: "column-todo", name: "To Do", position: 0 }),
			projectColumn({ id: "column-doing", name: "Doing", position: 1 }),
			projectColumn({ id: "column-done", name: "Done", position: 2 }),
		];

		expect(
			reorderProjectColumnsForPlacement(columns, {
				sourceColumnId: "column-done",
				targetColumnId: "column-todo",
				placement: "before",
			})?.map((column) => column.id),
		).toEqual(["column-done", "column-todo", "column-doing"]);
		expect(
			reorderProjectColumnsForPlacement(columns, {
				sourceColumnId: "column-todo",
				targetColumnId: "column-done",
				placement: "after",
			})?.map((column) => column.id),
		).toEqual(["column-doing", "column-done", "column-todo"]);
		expect(
			reorderProjectColumnsForPlacement(columns, {
				sourceColumnId: "column-doing",
				targetColumnId: "column-doing",
				placement: "before",
			}),
		).toBeNull();
		expect(
			reorderProjectColumnsForPlacement(columns, {
				sourceColumnId: "column-doing",
				targetColumnId: "column-done",
				placement: "before",
			}),
		).toBeNull();
	});

	it("optimistically reorders columns and invalidates after success", async () => {
		const queryClient = createTestQueryClient();
		const originalColumns = [
			projectColumn({ id: "column-todo", name: "To Do", position: 0 }),
			projectColumn({ id: "column-doing", name: "Doing", position: 1 }),
			projectColumn({ id: "column-done", name: "Done", position: 2 }),
		];
		queryClient.setQueryData(
			projectColumnsQueryOptions("project-1").queryKey,
			originalColumns,
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		const reorderedColumns = [
			originalColumns[1],
			originalColumns[0],
			originalColumns[2],
		].map((column, index) => ({ ...column, position: index }));
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValue(projectColumnsResponse(reorderedColumns));
		vi.stubGlobal("fetch", fetchSpy);

		const { result } = renderHook(() => useProjectTaskBoard("project-1"), {
			wrapper: createWrapper(queryClient),
		});

		act(() => {
			result.current.moveColumn({
				columnId: "column-doing",
				direction: "left",
			});
		});

		expect(result.current.columns.map((column) => column.id)).toEqual([
			"column-doing",
			"column-todo",
			"column-done",
		]);
		expect(result.current.columnReorderState.isColumnReorderPending).toBe(true);
		await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
		const [url, init] = fetchSpy.mock.calls[0];
		expect(url).toBe(
			"https://api.example.test/projects/project-1/columns/reorder",
		);
		expect(init?.method).toBe("PUT");
		expect(JSON.parse(String(init?.body))).toEqual({
			column_ids: ["column-doing", "column-todo", "column-done"],
		});
		await waitFor(() =>
			expect(result.current.columnReorderState.isColumnReorderPending).toBe(
				false,
			),
		);
		expect(result.current.columnReorderState.columnReorderError).toBeNull();
	});

	it("optimistically reorders columns from pointer placement", async () => {
		const queryClient = createTestQueryClient();
		const originalColumns = [
			projectColumn({ id: "column-todo", name: "To Do", position: 0 }),
			projectColumn({ id: "column-doing", name: "Doing", position: 1 }),
			projectColumn({ id: "column-done", name: "Done", position: 2 }),
		];
		queryClient.setQueryData(
			projectColumnsQueryOptions("project-1").queryKey,
			originalColumns,
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValue(projectColumnsResponse(originalColumns));
		vi.stubGlobal("fetch", fetchSpy);

		const { result } = renderHook(() => useProjectTaskBoard("project-1"), {
			wrapper: createWrapper(queryClient),
		});

		act(() => {
			result.current.reorderColumn({
				sourceColumnId: "column-done",
				targetColumnId: "column-todo",
				placement: "before",
			});
		});

		expect(result.current.columns.map((column) => column.id)).toEqual([
			"column-done",
			"column-todo",
			"column-doing",
		]);
		await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
		expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({
			column_ids: ["column-done", "column-todo", "column-doing"],
		});
	});

	it("rolls back optimistic column reordering on API failure", async () => {
		const queryClient = createTestQueryClient();
		const originalColumns = [
			projectColumn({ id: "column-todo", name: "To Do", position: 0 }),
			projectColumn({ id: "column-done", name: "Done", position: 1 }),
		];
		queryClient.setQueryData(
			projectColumnsQueryOptions("project-1").queryKey,
			originalColumns,
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		vi.stubGlobal(
			"fetch",
			vi
				.fn<typeof fetch>()
				.mockResolvedValue(
					new Response(JSON.stringify({ detail: "failed" }), { status: 500 }),
				),
		);

		const { result } = renderHook(() => useProjectTaskBoard("project-1"), {
			wrapper: createWrapper(queryClient),
		});

		act(() => {
			result.current.moveColumn({ columnId: "column-done", direction: "left" });
		});

		await waitFor(() =>
			expect(
				queryClient.getQueryData(
					projectColumnsQueryOptions("project-1").queryKey,
				),
			).toEqual(originalColumns),
		);
		expect(result.current.columnReorderState.columnReorderError).toBe(
			"Column reorder failed. Your board was restored.",
		);
	});

	it("locks task movement while a column reorder is pending", async () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			projectColumn({ id: "column-todo", name: "To Do", position: 0 }),
			projectColumn({ id: "column-done", name: "Done", position: 1 }),
		]);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({ id: "blocked", columnId: "column-todo", rank: "U" }),
		]);
		let resolveReorder: (response: Response) => void = () => undefined;
		const reorderPromise = new Promise<Response>((resolve) => {
			resolveReorder = resolve;
		});
		const fetchSpy = vi.fn<typeof fetch>().mockReturnValue(reorderPromise);
		vi.stubGlobal("fetch", fetchSpy);

		const { result } = renderHook(() => useProjectTaskBoard("project-1"), {
			wrapper: createWrapper(queryClient),
		});

		act(() => {
			result.current.moveColumn({ columnId: "column-done", direction: "left" });
			result.current.moveTask({ taskId: "blocked", toColumnId: "column-done" });
		});

		expect(result.current.columnReorderState.isColumnReorderPending).toBe(true);
		await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
		expect(
			queryClient
				.getQueryData<Task[]>(projectTasksQueryOptions("project-1").queryKey)
				?.find((cachedTask) => cachedTask.id === "blocked"),
		).toMatchObject({ columnId: "column-todo" });

		act(() => {
			resolveReorder(
				projectColumnsResponse([
					projectColumn({ id: "column-done", name: "Done", position: 0 }),
					projectColumn({ id: "column-todo", name: "To Do", position: 1 }),
				]),
			);
		});

		await waitFor(() =>
			expect(result.current.columnReorderState.isColumnReorderPending).toBe(
				false,
			),
		);
	});

	it("locks column reordering while a task move is pending", async () => {
		const queryClient = createTestQueryClient();
		const originalColumns = [
			projectColumn({ id: "column-todo", name: "To Do", position: 0 }),
			projectColumn({ id: "column-done", name: "Done", position: 1 }),
		];
		queryClient.setQueryData(
			projectColumnsQueryOptions("project-1").queryKey,
			originalColumns,
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({ id: "moving", columnId: "column-todo", rank: "U" }),
		]);
		let resolveMove: (response: Response) => void = () => undefined;
		const movePromise = new Promise<Response>((resolve) => {
			resolveMove = resolve;
		});
		const fetchSpy = vi.fn<typeof fetch>().mockReturnValue(movePromise);
		vi.stubGlobal("fetch", fetchSpy);

		const { result } = renderHook(() => useProjectTaskBoard("project-1"), {
			wrapper: createWrapper(queryClient),
		});

		act(() => {
			result.current.moveTask({ taskId: "moving", toColumnId: "column-done" });
			result.current.moveColumn({ columnId: "column-done", direction: "left" });
		});

		expect(result.current.moveState.isMovePending).toBe(true);
		await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
		expect(
			queryClient.getQueryData(
				projectColumnsQueryOptions("project-1").queryKey,
			),
		).toEqual(originalColumns);

		act(() => {
			resolveMove(
				taskResponse({ id: "moving", columnId: "column-done", rank: "U" }),
			);
		});

		await waitFor(() =>
			expect(result.current.moveState.isMovePending).toBe(false),
		);
	});
});
