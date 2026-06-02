// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { projectTasksQueryOptions, type Task } from "#/api/client";
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
		status: "todo",
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
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({ id: "done-task", title: "Done", status: "done" }),
			task({ id: "todo-task", title: "Todo", status: "todo" }),
		]);

		const { result } = renderHook(() => useProjectTaskBoard("project-1"), {
			wrapper: createWrapper(queryClient),
		});

		expect(result.current.columns.map((column) => column.id)).toEqual([
			"todo",
			"in-progress",
			"done",
		]);
		expect(result.current.columns[0].cards.map((card) => card.id)).toEqual([
			"todo-task",
		]);
		expect(result.current.columns[2].cards.map((card) => card.id)).toEqual([
			"done-task",
		]);

		act(() => {
			result.current.dragState.setDraggingTaskId("todo-task");
			result.current.dragState.setActiveDropColumnId("done");
		});

		expect(result.current.dragState.draggingTaskId).toBe("todo-task");
		expect(result.current.dragState.activeDropColumnId).toBe("done");
	});

	it("optimistically moves a task and invalidates after success", async () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({ id: "moved", status: "todo", rank: "U" }),
			task({ id: "done-first", status: "done", rank: "U" }),
		]);
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: "moved",
					project_id: "project-1",
					title: "Task",
					status: "done",
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
				toColumnId: "done",
				afterTaskId: "done-first",
			});
		});

		expect(
			queryClient
				.getQueryData<Task[]>(projectTasksQueryOptions("project-1").queryKey)
				?.find((cachedTask) => cachedTask.id === "moved"),
		).toMatchObject({ status: "done", rank: "F" });

		await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
		const [, init] = fetchSpy.mock.calls[0];
		expect(JSON.parse(String(init?.body))).toEqual({
			status: "done",
			rank: "F",
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
		const originalTasks = [
			task({ id: "moved", status: "todo", rank: "U" }),
			task({ id: "done-first", status: "done", rank: "U" }),
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
				toColumnId: "done",
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
	});
});
