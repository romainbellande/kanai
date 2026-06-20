// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getStaleTaskShapingDraftFields,
	getTaskFormWorkflowState,
	STORY_POINT_OPTIONS,
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
		sprint_id: null,
		title: "Created task",
		column_id: "todo",
		priority: null,
		story_points: null,
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
		sprintId: null,
		backlogRank: null,
		title: "Existing task",
		columnId: "in-progress",
		priority: "high",
		storyPoints: 5,
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

function a2aStreamResponse(...chunks: string[]): Response {
	const encoder = new TextEncoder();
	return new Response(
		new ReadableStream<Uint8Array>({
			start(controller) {
				for (const [index, chunk] of chunks.entries()) {
					controller.enqueue(
						encoder.encode(
							`data: ${JSON.stringify(a2aArtifactEvent(chunk, index > 0))}\n\n`,
						),
					);
				}
				controller.close();
			},
		}),
		{ headers: { "content-type": "text/event-stream" }, status: 200 },
	);
}

function controlledA2aStreamResponse() {
	const encoder = new TextEncoder();
	let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
	const response = new Response(
		new ReadableStream<Uint8Array>({
			start(streamController) {
				controller = streamController;
			},
		}),
		{ headers: { "content-type": "text/event-stream" }, status: 200 },
	);

	return {
		response,
		enqueue(chunk: string, append: boolean) {
			controller?.enqueue(
				encoder.encode(
					`data: ${JSON.stringify(a2aArtifactEvent(chunk, append))}\n\n`,
				),
			);
		},
		close() {
			controller?.close();
		},
	};
}

function a2aArtifactEvent(chunk: string, append: boolean) {
	return {
		jsonrpc: "2.0",
		id: 1,
		result: {
			artifactUpdate: {
				taskId: "task-1",
				contextId: "context-1",
				artifact: {
					artifactId: "acceptance-criteria-delta",
					name: "acceptanceCriteriaDelta",
					parts: [{ text: chunk }],
				},
				append,
				lastChunk: false,
			},
		},
	};
}

function findProjectTaskPayload(value: unknown): unknown {
	if (!value || typeof value !== "object") {
		return undefined;
	}

	if ("projectTask" in value) {
		return value;
	}

	for (const nestedValue of Object.values(value)) {
		const match = findProjectTaskPayload(nestedValue);
		if (match) {
			return match;
		}
	}

	return undefined;
}

function expectA2aProjectTaskPayload(body: string, projectTask: unknown) {
	expect(findProjectTaskPayload(JSON.parse(body))).toEqual({
		projectId: "project-1",
		projectTask,
	});
}

function a2aAgentCardResponse(): Response {
	return new Response(
		JSON.stringify({
			name: "Acceptance Criteria Agent",
			description: "Generates acceptance criteria.",
			version: "0.1.0",
			capabilities: { streaming: true, pushNotifications: false },
			defaultInputModes: ["application/json"],
			defaultOutputModes: ["text/plain"],
			supportedInterfaces: [
				{
					url: "https://api.example.test/a2a/acceptance-criteria",
					protocolBinding: "JSONRPC",
					protocolVersion: "1.0",
				},
			],
			skills: [],
		}),
		{ headers: { "content-type": "application/json" } },
	);
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

	it("blocks when a required default workflow column is missing", () => {
		expect(
			getTaskFormWorkflowState({
				columns: [
					{ id: "column-done", name: "Done" },
					{ id: "column-review", name: "Review" },
				],
				defaultColumnId: "column-todo",
				defaultColumnMissingMessage: "A non-Done workflow column is required.",
				isLoading: false,
				requireDefaultColumn: true,
				selectedColumnId: "",
			}),
		).toEqual({
			isBlocked: true,
			message: "A non-Done workflow column is required.",
			selectedColumnId: "column-todo",
		});
	});
});

describe("getStaleTaskShapingDraftFields", () => {
	const values = {
		title: "Source title",
		status: "todo",
		priority: "",
		storyPoints: "",
		description: "Source description",
		acceptanceCriteria: "Source criteria",
		tag: "",
		prerequisiteTaskIds: [],
	};

	it("marks only the field changed after its draft was produced", () => {
		expect(
			getStaleTaskShapingDraftFields({
				drafts: {
					title: "Draft title",
					description: "Draft description",
					acceptanceCriteria: "Draft criteria",
				},
				sources: {
					title: "Source title",
					description: "Source description",
					acceptanceCriteria: "Source criteria",
				},
				values: { ...values, title: "Edited title" },
			}),
		).toEqual(["title"]);
	});

	it("does not mark unrelated field drafts stale", () => {
		expect(
			getStaleTaskShapingDraftFields({
				drafts: {
					description: "Draft description",
					acceptanceCriteria: "Draft criteria",
				},
				sources: {
					description: "Source description",
					acceptanceCriteria: "Source criteria",
				},
				values: { ...values, title: "Edited title" },
			}),
		).toEqual([]);
	});

	it("keeps an applied draft from immediately becoming stale", () => {
		expect(
			getStaleTaskShapingDraftFields({
				drafts: { acceptanceCriteria: "Draft criteria" },
				sources: { acceptanceCriteria: "Source criteria" },
				values: { ...values, acceptanceCriteria: "Draft criteria" },
			}),
		).toEqual([]);
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
			storyPoints: "",
			description: "",
			acceptanceCriteria: "",
			tag: "",
			prerequisiteTaskIds: [],
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
						story_points: 8,
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
			result.current.setField("storyPoints", "8");
			result.current.setField("description", "  Useful notes  ");
			result.current.setField("acceptanceCriteria", "  Done means done  ");
			result.current.setPrerequisiteTaskIds(["task-a", "task-b"]);
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
			story_points: 8,
			description: "Useful notes",
			acceptance_criteria: "Done means done",
			prerequisite_task_ids: ["task-a", "task-b"],
		});
		expect(onSaved).toHaveBeenCalledWith(
			expect.objectContaining({ id: "task-1", title: "Created task" }),
		);
	});

	it("submits supported story point options on create", async () => {
		const queryClient = createTestQueryClient();
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify(createdTask({ story_points: 13 })), {
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
			result.current.setField("title", "Estimated task");
			result.current.setField("storyPoints", "13");
		});

		await act(async () => {
			await result.current.submit();
		});

		expect(STORY_POINT_OPTIONS).toEqual([1, 2, 3, 5, 8, 13]);
		expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual(
			expect.objectContaining({ story_points: 13 }),
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

	it("marks created tasks for active sprint membership when requested", async () => {
		const queryClient = createTestQueryClient();
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify(
					createdTask({
						title: "Sprint task",
						sprint_id: "sprint-1",
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
					includeInActiveSprint: true,
					defaultColumnId: "column-todo",
					workflowColumns: [
						{ id: "column-done", name: "Done" },
						{ id: "column-todo", name: "To Do" },
					],
				}),
			{ wrapper: createWrapper(queryClient) },
		);

		await waitFor(() =>
			expect(result.current.values.status).toBe("column-todo"),
		);

		act(() => {
			result.current.setField("title", "Sprint task");
		});

		await act(async () => {
			await result.current.submit();
		});

		expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({
			title: "Sprint task",
			column_id: "column-todo",
			include_in_active_sprint: true,
		});
	});

	it("creates Backlog tasks through the Backlog API without sprint membership", async () => {
		const queryClient = createTestQueryClient();
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify(
					createdTask({
						title: "Backlog task",
						column_id: "column-todo",
						backlog_rank: "F",
						tag: "UX",
					}),
				),
				{ headers: { "content-type": "application/json" }, status: 201 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		const { result } = renderHook(
			() =>
				useTaskForm({
					projectId: "project-1",
					mode: "create",
					createInBacklog: true,
					defaultColumnId: "column-todo",
					requireDefaultColumn: true,
					workflowColumns: [
						{ id: "column-todo", name: "To Do" },
						{ id: "column-done", name: "Done" },
					],
				}),
			{ wrapper: createWrapper(queryClient) },
		);

		await waitFor(() =>
			expect(result.current.values.status).toBe("column-todo"),
		);

		act(() => {
			result.current.setField("title", "Backlog task");
			result.current.setField("tag", "UX");
		});

		await act(async () => {
			await result.current.submit();
		});

		expect(fetchSpy.mock.calls[0][0]).toBe(
			"https://api.example.test/projects/project-1/backlog/tasks",
		);
		expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({
			title: "Backlog task",
			column_id: "column-todo",
			tag: "UX",
		});
	});

	it("prompts for task context without calling A2A", async () => {
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

		expect(result.current.acceptanceCriteriaGeneration.canGenerate).toBe(false);
		expect(result.current.acceptanceCriteriaGeneration.message).toBe(
			"Add a task title or description before generating acceptance criteria.",
		);

		await act(async () => {
			await result.current.acceptanceCriteriaGeneration.generate();
		});

		expect(fetchSpy).not.toHaveBeenCalled();
		expect(result.current.acceptanceCriteriaGeneration.message).toBe(
			"Add a task title or description before generating acceptance criteria.",
		);
	});

	it("streams generated acceptance criteria from create form metadata", async () => {
		const queryClient = createTestQueryClient();
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(a2aAgentCardResponse())
			.mockResolvedValueOnce(
				a2aStreamResponse("- First criterion", "\n- Second criterion"),
			);
		vi.stubGlobal("fetch", fetchSpy);

		const { result } = renderHook(
			() =>
				useTaskForm({
					projectId: "project-1",
					mode: "create",
					workflowColumns: [
						{ id: "column-todo", name: "To Do" },
						{ id: "column-review", name: "Review" },
					],
				}),
			{ wrapper: createWrapper(queryClient) },
		);

		act(() => {
			result.current.setField("title", "  Generate task  ");
			result.current.setField("status", "column-review");
			result.current.setField("priority", "high");
			result.current.setField("storyPoints", "5");
			result.current.setField("description", "  Helpful context  ");
			result.current.setField("acceptanceCriteria", "  Existing draft  ");
			result.current.setField("tag", "  UX  ");
		});

		await act(async () => {
			await result.current.acceptanceCriteriaGeneration.generate();
		});

		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(String(fetchSpy.mock.calls[1][0])).toBe(
			"https://api.example.test/a2a/acceptance-criteria",
		);
		expect(
			new Headers(fetchSpy.mock.calls[1][1]?.headers).get("Authorization"),
		).toBe("Bearer task-form-token");
		expectA2aProjectTaskPayload(String(fetchSpy.mock.calls[1][1]?.body), {
			title: "Generate task",
			description: "Helpful context",
			acceptanceCriteria: "Existing draft",
			priority: "high",
			storyPoints: 5,
			tag: "UX",
			workflowColumn: "Review",
			mode: "create",
		});
		expect(result.current.values.acceptanceCriteria).toBe(
			"- First criterion\n- Second criterion",
		);
		expect(result.current.acceptanceCriteriaGeneration.isGenerating).toBe(
			false,
		);
		expect(result.current.isDirty).toBe(true);
	});

	it("clears existing criteria while generation streams before replacing it", async () => {
		const queryClient = createTestQueryClient();
		const stream = controlledA2aStreamResponse();
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(a2aAgentCardResponse())
			.mockResolvedValueOnce(stream.response);
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
			result.current.setField("title", "Generate task");
			result.current.setField("acceptanceCriteria", "Previous draft");
		});

		let generation: Promise<void>;
		act(() => {
			generation = result.current.acceptanceCriteriaGeneration.generate();
		});

		await waitFor(() =>
			expect(result.current.acceptanceCriteriaGeneration.isGenerating).toBe(
				true,
			),
		);
		expect(result.current.values.acceptanceCriteria).toBe("");

		await act(async () => {
			stream.enqueue("- Replacement", false);
			stream.enqueue("\n- Continued", true);
			stream.close();
			await generation;
		});

		expectA2aProjectTaskPayload(
			String(fetchSpy.mock.calls[1][1]?.body),
			expect.objectContaining({ acceptanceCriteria: "Previous draft" }),
		);
		expect(result.current.values.acceptanceCriteria).toBe(
			"- Replacement\n- Continued",
		);
		expect(result.current.acceptanceCriteriaGeneration.isGenerating).toBe(
			false,
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
			storyPoints: "5",
			description: "Current notes",
			acceptanceCriteria: "Current criteria",
			tag: "frontend",
			prerequisiteTaskIds: [],
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
						story_points: 8,
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
			result.current.setField("storyPoints", "8");
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
			story_points: 8,
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

	it("clears story points on edit submit", async () => {
		const queryClient = createTestQueryClient();
		const existingTask = task({ storyPoints: 8 });
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify(
					createdTask({
						title: "Existing task",
						column_id: "in-progress",
						story_points: null,
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
			result.current.setField("storyPoints", "");
		});

		await act(async () => {
			await result.current.submit();
		});

		const [, init] = fetchSpy.mock.calls[0];
		expect(JSON.parse(String(init?.body))).toEqual(
			expect.objectContaining({ story_points: null }),
		);
	});

	it("prompts for edit task context without calling A2A", async () => {
		const queryClient = createTestQueryClient();
		const existingTask = task({ title: "", description: "" });
		const fetchSpy = vi.fn<typeof fetch>();
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

		expect(result.current.acceptanceCriteriaGeneration.canGenerate).toBe(false);
		expect(result.current.acceptanceCriteriaGeneration.message).toBe(
			"Add a task title or description before generating acceptance criteria.",
		);

		await act(async () => {
			await result.current.acceptanceCriteriaGeneration.generate();
		});

		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("streams generated edit criteria and persists them only on submit", async () => {
		const queryClient = createTestQueryClient();
		const onSaved = vi.fn();
		const existingTask = task();
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(a2aAgentCardResponse())
			.mockResolvedValueOnce(
				a2aStreamResponse("- Regenerated criterion", "\n- Save later"),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify(
						createdTask({
							title: "Existing task",
							column_id: "in-progress",
							priority: "high",
							story_points: 5,
							description: "Current notes",
							acceptance_criteria: "- Regenerated criterion\n- Save later",
							tag: "frontend",
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

		await act(async () => {
			await result.current.acceptanceCriteriaGeneration.generate();
		});

		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(String(fetchSpy.mock.calls[1][0])).toBe(
			"https://api.example.test/a2a/acceptance-criteria",
		);
		expect(
			new Headers(fetchSpy.mock.calls[1][1]?.headers).get("Authorization"),
		).toBe("Bearer task-form-token");
		expectA2aProjectTaskPayload(String(fetchSpy.mock.calls[1][1]?.body), {
			title: "Existing task",
			description: "Current notes",
			acceptanceCriteria: "Current criteria",
			priority: "high",
			storyPoints: 5,
			tag: "frontend",
			workflowColumn: "In Progress",
			mode: "edit",
		});
		expect(result.current.values.acceptanceCriteria).toBe(
			"- Regenerated criterion\n- Save later",
		);
		expect(result.current.isDirty).toBe(true);

		await act(async () => {
			await result.current.submit();
		});

		expect(fetchSpy).toHaveBeenCalledTimes(3);
		expect(JSON.parse(String(fetchSpy.mock.calls[2][1]?.body))).toEqual({
			title: "Existing task",
			column_id: "in-progress",
			priority: "high",
			story_points: 5,
			description: "Current notes",
			acceptance_criteria: "- Regenerated criterion\n- Save later",
			tag: "frontend",
		});
		expect(onSaved).toHaveBeenCalledWith(
			expect.objectContaining({
				acceptanceCriteria: "- Regenerated criterion\n- Save later",
			}),
		);
		expect(result.current.isDirty).toBe(false);
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

	it("shows backend validation details on edit submit", async () => {
		const queryClient = createTestQueryClient();
		const existingTask = task({ prerequisiteTaskIds: ["task-a"] });
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					detail: "Prerequisite tasks cannot create a cycle",
				}),
				{ headers: { "content-type": "application/json" }, status: 422 },
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

		await act(async () => {
			await result.current.submit();
		});

		expect(result.current.errorMessage).toBe(
			"Prerequisite tasks cannot create a cycle",
		);
	});
});
