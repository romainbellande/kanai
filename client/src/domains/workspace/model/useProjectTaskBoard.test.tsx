// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	projectColumnsQueryOptions,
	projectTasksQueryOptions,
	type Task,
} from "#/api/client";
import { useProjectTaskBoard } from "#/domains/workspace/model/useProjectTaskBoard";

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

describe("useProjectTaskBoard", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		window.sessionStorage.clear();
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "board-token" }),
		);
	});

	it("exposes grouped columns and drag state", () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			{
				id: "column-backlog",
				projectId: "project-1",
				name: "Backlog",
				position: 0,
				createdAt: null,
				updatedAt: null,
			},
			{
				id: "column-review",
				projectId: "project-1",
				name: "Review",
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
				position: 0,
				createdAt: null,
				updatedAt: null,
			},
			{
				id: "column-done",
				projectId: "project-1",
				name: "Done",
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
				position: 0,
				createdAt: null,
				updatedAt: null,
			},
			{
				id: "column-done",
				projectId: "project-1",
				name: "Done",
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

	it("allows only one in-flight move", async () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			{
				id: "column-todo",
				projectId: "project-1",
				name: "To Do",
				position: 0,
				createdAt: null,
				updatedAt: null,
			},
			{
				id: "column-done",
				projectId: "project-1",
				name: "Done",
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
});
