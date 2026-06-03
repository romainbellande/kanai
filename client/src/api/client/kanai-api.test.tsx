// @vitest-environment jsdom

import {
	QueryClient,
	QueryClientProvider,
	useQuery,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type Task, useKanaiApi } from "#/api/client";

function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false },
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

describe("useKanaiApi", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		window.sessionStorage.clear();
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "facade-token" }),
		);
	});

	it("lists project tasks through the generated adapter using a stable query key", async () => {
		const queryClient = createTestQueryClient();
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify([
					{
						id: "task-1",
						project_id: "project-1",
						title: "Facade Task",
						column_id: "column-todo",
						priority: "medium",
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

		const { result } = renderHook(
			() => {
				const api = useKanaiApi();
				return useQuery(api.tasks.list("project-1"));
			},
			{ wrapper: createWrapper(queryClient) },
		);

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data).toMatchObject([
			{ id: "task-1", projectId: "project-1", title: "Facade Task" },
		]);
		expect(
			queryClient.getQueryData(["projects", "project-1", "tasks"]),
		).toEqual(result.current.data);
		expect(fetchSpy).toHaveBeenCalledWith(
			"https://api.example.test/projects/project-1/tasks",
			expect.objectContaining({ method: "GET" }),
		);
	});

	it("patches and restores a task inside the project task cache", () => {
		const queryClient = createTestQueryClient();
		const originalTasks = [
			task({ id: "task-1", title: "Original" }),
			task({ id: "task-2", title: "Unchanged" }),
		];
		queryClient.setQueryData(["projects", "project-1", "tasks"], originalTasks);

		const { result } = renderHook(() => useKanaiApi(), {
			wrapper: createWrapper(queryClient),
		});

		let previousTasks: Task[] | undefined;
		act(() => {
			previousTasks = result.current.tasks.patchCached("project-1", "task-1", {
				title: "Patched",
				columnId: "column-done",
			});
		});

		expect(
			queryClient.getQueryData(["projects", "project-1", "tasks"]),
		).toEqual([
			task({ id: "task-1", title: "Patched", columnId: "column-done" }),
			task({ id: "task-2", title: "Unchanged" }),
		]);

		act(() => {
			result.current.tasks.replaceCached("project-1", previousTasks);
		});

		expect(
			queryClient.getQueryData(["projects", "project-1", "tasks"]),
		).toEqual(originalTasks);
	});

	it("creates a project task with app-shaped input and invalidates project tasks", async () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(["projects", "project-1", "tasks"], []);
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: "task-1",
					project_id: "project-1",
					title: "Created",
					column_id: "column-todo",
					priority: "medium",
					rank: "U",
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

		const { result } = renderHook(() => useKanaiApi(), {
			wrapper: createWrapper(queryClient),
		});

		await act(async () => {
			await result.current.tasks.create("project-1", {
				title: "Created",
				columnId: "column-todo",
				priority: "medium",
			});
		});

		const [, init] = fetchSpy.mock.calls[0];
		expect(JSON.parse(String(init?.body))).toEqual({
			title: "Created",
			column_id: "column-todo",
			priority: "medium",
		});
		expect(
			queryClient.getQueryState(["projects", "project-1", "tasks"])
				?.isInvalidated,
		).toBe(true);
	});

	it("invalidates project tasks on request", async () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(["projects", "project-1", "tasks"], []);
		const { result } = renderHook(() => useKanaiApi(), {
			wrapper: createWrapper(queryClient),
		});

		await act(async () => {
			await result.current.tasks.invalidateProjectTasks("project-1");
		});

		expect(
			queryClient.getQueryState(["projects", "project-1", "tasks"])
				?.isInvalidated,
		).toBe(true);
	});

	it("exposes project and current-user queries through stable facade keys", () => {
		const queryClient = createTestQueryClient();
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify({ id: "user-1" }), {
				headers: { "content-type": "application/json" },
				status: 200,
			}),
		);
		vi.stubGlobal("fetch", fetchSpy);

		renderHook(
			() => {
				const api = useKanaiApi();
				useQuery(api.projects.get("project-1"));
				useQuery(api.currentUser.get());
			},
			{ wrapper: createWrapper(queryClient) },
		);

		expect(queryClient.getQueryState(["projects", "project-1"])).toBeDefined();
		expect(queryClient.getQueryState(["users", "me"])).toBeDefined();
	});

	it("exposes project column queries through the facade", async () => {
		const queryClient = createTestQueryClient();
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify([
					{
						id: "column-1",
						project_id: "project-1",
						name: "Backlog",
						position: 0,
						created_at: null,
						updated_at: null,
					},
				]),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		const { result } = renderHook(
			() => {
				const api = useKanaiApi();
				return useQuery(api.projectColumns.list("project-1"));
			},
			{ wrapper: createWrapper(queryClient) },
		);

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data).toEqual([
			{
				id: "column-1",
				projectId: "project-1",
				name: "Backlog",
				position: 0,
				createdAt: null,
				updatedAt: null,
			},
		]);
		expect(
			queryClient.getQueryData(["projects", "project-1", "columns"]),
		).toEqual(result.current.data);
	});
});
