// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getTaskFormWorkflowState,
	useTaskForm,
} from "#/domains/workspace/model/useTaskForm";

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

function createdTask(overrides: Record<string, unknown> = {}) {
	return {
		id: "task-1",
		projectId: "project-1",
		project_id: "project-1",
		title: "Created task",
		column_id: "todo",
		priority: null,
		rank: "0|hzzzzz:",
		assignee_id: null,
		description: null,
		acceptance_criteria: null,
		tag: null,
		created_at: null,
		updated_at: null,
		...overrides,
	};
}

function task(overrides: Record<string, unknown> = {}) {
	return {
		id: "task-1",
		projectId: "project-1",
		title: "Existing task",
		columnId: "in-progress",
		priority: "high",
		rank: "0|hzzzzz:",
		assigneeId: null,
		description: "Current notes",
		acceptanceCriteria: "Current criteria",
		tag: "frontend",
		createdAt: null,
		updatedAt: null,
		...overrides,
	};
}

describe("getTaskFormWorkflowState", () => {
	it("selects the first loaded column by default", () => {
		expect(
			getTaskFormWorkflowState({
				columns: [
					{ id: "column-backlog", name: "Backlog" },
					{ id: "column-review", name: "Review" },
				],
				isLoading: false,
				selectedColumnId: "",
			}),
		).toEqual({
			isBlocked: false,
			message: null,
			selectedColumnId: "column-backlog",
		});
	});

	it("blocks submission while columns are loading", () => {
		expect(
			getTaskFormWorkflowState({
				columns: undefined,
				isLoading: true,
				selectedColumnId: "",
			}),
		).toEqual({
			isBlocked: true,
			message: "Loading project workflow columns...",
			selectedColumnId: "",
		});
	});

	it("blocks submission when loaded columns are empty", () => {
		expect(
			getTaskFormWorkflowState({
				columns: [],
				isLoading: false,
				selectedColumnId: "",
			}),
		).toEqual({
			isBlocked: true,
			message:
				"This project has no workflow columns. Add a workflow column before creating tasks.",
			selectedColumnId: "",
		});
	});

	it("falls back to the first column for invalid selections", () => {
		expect(
			getTaskFormWorkflowState({
				columns: [
					{ id: "column-backlog", name: "Backlog" },
					{ id: "column-review", name: "Review" },
				],
				isLoading: false,
				selectedColumnId: "legacy-status",
			}),
		).toEqual({
			isBlocked: false,
			message: null,
			selectedColumnId: "column-backlog",
		});
	});

	it("blocks edit submission when the selected task column is missing", () => {
		expect(
			getTaskFormWorkflowState({
				columns: [
					{ id: "column-backlog", name: "Backlog" },
					{ id: "column-review", name: "Review" },
				],
				isLoading: false,
				selectedColumnId: "missing-column",
				requireSelectedColumn: true,
			}),
		).toEqual({
			isBlocked: true,
			message:
				"This task references a workflow column that no longer exists. Choose a valid column after the task data is repaired.",
			selectedColumnId: "missing-column",
		});
	});
});

describe("useTaskForm create mode", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		window.sessionStorage.clear();
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "task-form-token" }),
		);
	});

	it("starts create mode with default values and no workflow selection", () => {
		const queryClient = createTestQueryClient();

		const { result } = renderHook(
			() =>
				useTaskForm({
					projectId: "project-1",
					mode: "create",
					initialColumnId: "column-unknown",
				}),
			{ wrapper: createWrapper(queryClient) },
		);

		expect(result.current.values).toEqual({
			title: "",
			status: "column-unknown",
			priority: "",
			description: "",
			acceptanceCriteria: "",
			tag: "",
		});
		expect(result.current.isDirty).toBe(false);
		expect(result.current.isSaving).toBe(false);
		expect(result.current.errorMessage).toBeNull();
	});

	it("uses loaded columns to choose the initial workflow column", async () => {
		const queryClient = createTestQueryClient();

		const { result } = renderHook(
			() =>
				useTaskForm({
					projectId: "project-1",
					mode: "create",
					initialColumnId: "column-review",
					workflowColumns: [
						{ id: "column-backlog", name: "Backlog" },
						{ id: "column-review", name: "Review" },
					],
				}),
			{ wrapper: createWrapper(queryClient) },
		);

		await waitFor(() =>
			expect(result.current.values.status).toBe("column-review"),
		);

		act(() => {
			result.current.setField("title", "Draft task");
		});

		expect(result.current.values.title).toBe("Draft task");
		expect(result.current.values.status).toBe("column-review");
		expect(result.current.isDirty).toBe(true);
	});

	it("rejects create submit when title is blank", async () => {
		const queryClient = createTestQueryClient();
		const fetchSpy = vi.fn<typeof fetch>();
		vi.stubGlobal("fetch", fetchSpy);

		const { result } = renderHook(
			() =>
				useTaskForm({
					projectId: "project-1",
					mode: "create",
					workflowColumns: [{ id: "column-todo", name: "To Do" }],
				}),
			{ wrapper: createWrapper(queryClient) },
		);

		let submitted: Awaited<ReturnType<typeof result.current.submit>> = null;
		await act(async () => {
			submitted = await result.current.submit();
		});

		expect(submitted).toBeNull();
		expect(result.current.errorMessage).toBe("Task title is required.");
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("normalizes create payload and calls onSaved after success", async () => {
		const queryClient = createTestQueryClient();
		const onSaved = vi.fn();
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify(
					createdTask({
						title: "Created task",
						column_id: "done",
						priority: "high",
						description: "Useful notes",
						acceptance_criteria: "Done means done",
					}),
				),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		const { result } = renderHook(
			() =>
				useTaskForm({
					projectId: "project-1",
					mode: "create",
					workflowColumns: [
						{ id: "column-todo", name: "To Do" },
						{ id: "column-done", name: "Done" },
					],
					onSaved,
				}),
			{ wrapper: createWrapper(queryClient) },
		);

		act(() => {
			result.current.setField("title", "  Created task  ");
			result.current.setField("status", "column-done");
			result.current.setField("priority", "high");
			result.current.setField("description", "  Useful notes  ");
			result.current.setField("acceptanceCriteria", "  Done means done  ");
		});

		await act(async () => {
			await result.current.submit();
		});

		await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
		const [, init] = fetchSpy.mock.calls[0];
		expect(JSON.parse(String(init?.body))).toEqual({
			title: "Created task",
			column_id: "column-done",
			priority: "high",
			description: "Useful notes",
			acceptance_criteria: "Done means done",
		});
		expect(onSaved).toHaveBeenCalledWith(
			expect.objectContaining({ id: "task-1", title: "Created task" }),
		);
	});

	it("omits blank optional create fields and priority, then reports failed submit", async () => {
		const queryClient = createTestQueryClient();
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(JSON.stringify(createdTask({ title: "Minimal task" })), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ detail: "Nope" }), { status: 500 }),
			);
		vi.stubGlobal("fetch", fetchSpy);

		const { result } = renderHook(
			() =>
				useTaskForm({
					projectId: "project-1",
					mode: "create",
					workflowColumns: [{ id: "column-todo", name: "To Do" }],
				}),
			{ wrapper: createWrapper(queryClient) },
		);

		act(() => {
			result.current.setField("title", "Minimal task");
			result.current.setField("description", "   ");
			result.current.setField("acceptanceCriteria", "   ");
		});

		await act(async () => {
			await result.current.submit();
		});

		expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({
			title: "Minimal task",
			column_id: "column-todo",
		});

		await act(async () => {
			await result.current.submit();
		});

		expect(result.current.errorMessage).toBe(
			"Task could not be created. Please try again.",
		);
	});
});

describe("useTaskForm edit mode", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		window.sessionStorage.clear();
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "task-form-token" }),
		);
	});

	it("starts edit mode from the task and updates fields", () => {
		const queryClient = createTestQueryClient();
		const existingTask = task();

		const { result } = renderHook(
			() =>
				useTaskForm({
					projectId: "project-1",
					mode: "edit",
					taskId: "task-1",
					task: existingTask,
					workflowColumns: [{ id: "in-progress", name: "In Progress" }],
				}),
			{ wrapper: createWrapper(queryClient) },
		);

		expect(result.current.values).toEqual({
			title: "Existing task",
			status: "in-progress",
			priority: "high",
			description: "Current notes",
			acceptanceCriteria: "Current criteria",
			tag: "frontend",
		});
		expect(result.current.isDirty).toBe(false);

		act(() => {
			result.current.setField("title", "Changed task");
		});

		expect(result.current.values.title).toBe("Changed task");
		expect(result.current.isDirty).toBe(true);
	});

	it("normalizes edit payload with nullable clears and calls onSaved", async () => {
		const queryClient = createTestQueryClient();
		const onSaved = vi.fn();
		const existingTask = task();
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify(
					createdTask({
						title: "Updated task",
						column_id: "done",
						priority: "critical",
						description: null,
						acceptance_criteria: null,
						tag: null,
					}),
				),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		const { result } = renderHook(
			() =>
				useTaskForm({
					projectId: "project-1",
					mode: "edit",
					taskId: "task-1",
					task: existingTask,
					workflowColumns: [
						{ id: "in-progress", name: "In Progress" },
						{ id: "done", name: "Done" },
					],
					onSaved,
				}),
			{ wrapper: createWrapper(queryClient) },
		);

		act(() => {
			result.current.setField("title", "  Updated task  ");
			result.current.setField("status", "done");
			result.current.setField("priority", "critical");
			result.current.setField("description", "   ");
			result.current.setField("acceptanceCriteria", "   ");
			result.current.setField("tag", "   ");
		});

		await act(async () => {
			await result.current.submit();
		});

		await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
		const [, init] = fetchSpy.mock.calls[0];
		expect(JSON.parse(String(init?.body))).toEqual({
			title: "Updated task",
			column_id: "done",
			priority: "critical",
			description: null,
			acceptance_criteria: null,
			tag: null,
		});
		expect(onSaved).toHaveBeenCalledWith(
			expect.objectContaining({ id: "task-1", title: "Updated task" }),
		);
		expect(result.current.isDirty).toBe(false);
	});

	it("normalizes legacy urgent task priority to critical", () => {
		const queryClient = createTestQueryClient();
		const legacyTask = task({ priority: "urgent" });

		const { result } = renderHook(
			() =>
				useTaskForm({
					projectId: "project-1",
					mode: "edit",
					taskId: "task-1",
					task: legacyTask,
					workflowColumns: [{ id: "in-progress", name: "In Progress" }],
				}),
			{ wrapper: createWrapper(queryClient) },
		);

		expect(result.current.values.priority).toBe("critical");
	});

	it("clears task priority on edit submit", async () => {
		const queryClient = createTestQueryClient();
		const existingTask = task();
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify(
					createdTask({
						title: "Existing task",
						column_id: "in-progress",
						priority: null,
					}),
				),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		const { result } = renderHook(
			() =>
				useTaskForm({
					projectId: "project-1",
					mode: "edit",
					taskId: "task-1",
					task: existingTask,
					workflowColumns: [{ id: "in-progress", name: "In Progress" }],
				}),
			{ wrapper: createWrapper(queryClient) },
		);

		act(() => {
			result.current.setField("priority", "");
		});

		await act(async () => {
			await result.current.submit();
		});

		const [, init] = fetchSpy.mock.calls[0];
		expect(JSON.parse(String(init?.body))).toEqual(
			expect.objectContaining({ priority: null }),
		);
	});

	it.each([
		"low",
		"medium",
		"high",
		"critical",
	])("submits %s as a supported create priority", async (priority) => {
		const queryClient = createTestQueryClient();
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify(createdTask({ priority })), {
				headers: { "content-type": "application/json" },
				status: 200,
			}),
		);
		vi.stubGlobal("fetch", fetchSpy);

		const { result } = renderHook(
			() =>
				useTaskForm({
					projectId: "project-1",
					mode: "create",
					workflowColumns: [{ id: "column-todo", name: "To Do" }],
				}),
			{ wrapper: createWrapper(queryClient) },
		);

		act(() => {
			result.current.setField("title", "Prioritized task");
			result.current.setField("priority", priority);
		});

		await act(async () => {
			await result.current.submit();
		});

		expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual(
			expect.objectContaining({ priority }),
		);
	});

	it("reports failed edit submit", async () => {
		const queryClient = createTestQueryClient();
		const existingTask = task();
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValue(
				new Response(JSON.stringify({ detail: "Nope" }), { status: 500 }),
			);
		vi.stubGlobal("fetch", fetchSpy);

		const { result } = renderHook(
			() =>
				useTaskForm({
					projectId: "project-1",
					mode: "edit",
					taskId: "task-1",
					task: existingTask,
					workflowColumns: [{ id: "in-progress", name: "In Progress" }],
				}),
			{ wrapper: createWrapper(queryClient) },
		);

		act(() => {
			result.current.setField("title", "Updated task");
		});

		await act(async () => {
			await result.current.submit();
		});

		expect(result.current.errorMessage).toBe(
			"Task could not be saved. Please try again.",
		);
		expect(result.current.isDirty).toBe(true);
	});
});
