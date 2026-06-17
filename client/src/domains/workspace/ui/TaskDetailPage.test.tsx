// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	currentUserQueryOptions,
	type Project,
	type ProjectColumn,
	projectColumnsQueryOptions,
	projectQueryOptions,
	projectTasksQueryOptions,
	type Task,
} from "#/api/client";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		params,
		search,
		to,
		...props
	}: AnchorHTMLAttributes<HTMLAnchorElement> & {
		children: ReactNode;
		params?: { projectId?: string };
		search?: Record<string, boolean | string>;
		to: string;
	}) => {
		const href = params?.projectId
			? to.replace("$projectId", params.projectId)
			: to;
		const query = search
			? `?${new URLSearchParams(
					Object.fromEntries(
						Object.entries(search).map(([key, value]) => [key, String(value)]),
					),
				).toString()}`
			: "";

		return (
			<a href={`${href}${query}`} {...props}>
				{children}
			</a>
		);
	},
	useParams: () => ({ projectId: "project-1", taskId: "task-1" }),
}));

function task(overrides: Partial<Task> = {}): Task {
	return {
		id: "task-1",
		projectId: "project-1",
		sprintId: null,
		backlogRank: null,
		title: "Original Task",
		columnId: "todo",
		priority: "medium",
		storyPoints: 3,
		rank: "U",
		assigneeId: null,
		description: "Original notes",
		acceptanceCriteria: "Original criteria",
		tag: "Feature",
		createdAt: null,
		updatedAt: null,
		...overrides,
	};
}

function project(overrides: Partial<Project> = {}): Project {
	return {
		id: "project-1",
		name: "Launch Plan",
		code: "LCH",
		description: null,
		status: "active",
		ownerIds: [],
		memberIds: [],
		createdAt: null,
		updatedAt: null,
		...overrides,
	};
}

function column(overrides: Partial<ProjectColumn> = {}): ProjectColumn {
	return {
		id: "todo",
		projectId: "project-1",
		name: "Ready",
		description: null,
		position: 0,
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

	if ("projectTask" in value || "taskShapingTurn" in value) {
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

function taskShapingAgentCardResponse(): Response {
	return new Response(
		JSON.stringify({
			name: "Task Shaping Chat Agent",
			description: "Starts task shaping.",
			version: "0.1.0",
			capabilities: { streaming: true, pushNotifications: false },
			defaultInputModes: ["application/json"],
			defaultOutputModes: ["application/json"],
			supportedInterfaces: [
				{
					url: "https://api.example.test/a2a/task-shaping",
					protocolBinding: "JSONRPC",
					protocolVersion: "1.0",
				},
			],
			skills: [],
		}),
		{ headers: { "content-type": "application/json" } },
	);
}

function taskShapingTurnResponse(turn: unknown): Response {
	return new Response(
		`data: ${JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			result: {
				artifactUpdate: {
					taskId: "task-shaping-1",
					contextId: "task-shaping-1",
					artifact: {
						artifactId: "task-shaping-turn",
						name: "taskShapingTurn",
						parts: [{ data: turn }],
					},
					append: false,
					lastChunk: true,
				},
			},
		})}\n\n`,
		{ headers: { "content-type": "text/event-stream" }, status: 200 },
	);
}

function taskShapingQuestion(text: string, recommendedLabel: string) {
	return {
		text,
		answerOptions: [
			{
				identifier: "Recommended / Option",
				label: recommendedLabel,
				detail: "Use this visible answer detail.",
				responseText: "Use this visible answer detail.",
				isRecommended: true,
			},
			{
				identifier: "Other option",
				label: "Use another answer",
				detail: null,
				responseText: "Use another visible answer.",
				isRecommended: false,
			},
		],
	};
}

function failingA2aStreamResponse(...chunks: string[]): Response {
	const encoder = new TextEncoder();
	return new Response(
		new ReadableStream<Uint8Array>({
			start(controller) {
				for (const chunk of chunks) {
					controller.enqueue(
						encoder.encode(
							`data: ${JSON.stringify(a2aArtifactEvent(chunk, false))}\n\n`,
						),
					);
				}
				controller.error(new Error("Stream failed"));
			},
		}),
		{ headers: { "content-type": "text/event-stream" }, status: 200 },
	);
}

function abortableA2aStreamResponse(
	chunk: string,
	onCancel: () => void,
): Response {
	const encoder = new TextEncoder();
	return new Response(
		new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify(a2aArtifactEvent(chunk, false))}\n\n`,
					),
				);
			},
			cancel: onCancel,
		}),
		{ headers: { "content-type": "text/event-stream" }, status: 200 },
	);
}

function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
		},
	});
}

function renderTaskDetailPage(
	ui: ReactNode,
	queryClient = createTestQueryClient(),
) {
	queryClient.setQueryData(currentUserQueryOptions().queryKey, {
		id: "user-1",
		first_name: "Task",
		last_name: "Owner",
	});

	return render(
		<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
	);
}

describe("TaskDetailPage", () => {
	beforeEach(() => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "task-token" }),
		);
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		window.sessionStorage.clear();
	});

	it("shows selected task details and persists edits into the task cache", async () => {
		const { TaskDetailPage } = await import(
			"#/domains/workspace/ui/TaskDetailPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task(),
		]);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column(),
			column({ id: "done", name: "Released", position: 1 }),
		]);
		const updatedTask = task({
			columnId: "done",
			description: "Updated notes",
			priority: "high",
			storyPoints: 8,
			title: "Updated Task",
		});
		const updatedTaskJson = {
			id: updatedTask.id,
			project_id: updatedTask.projectId,
			title: updatedTask.title,
			column_id: updatedTask.columnId,
			priority: updatedTask.priority,
			story_points: updatedTask.storyPoints,
			rank: updatedTask.rank,
			assignee_id: updatedTask.assigneeId,
			description: updatedTask.description,
			acceptance_criteria: updatedTask.acceptanceCriteria,
			tag: updatedTask.tag,
			created_at: updatedTask.createdAt,
			updated_at: updatedTask.updatedAt,
		};
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(JSON.stringify(updatedTaskJson), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			)
			.mockResolvedValue(
				new Response(JSON.stringify([updatedTaskJson]), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			);
		vi.stubGlobal("fetch", fetchSpy);

		renderTaskDetailPage(<TaskDetailPage />, queryClient);
		expect(
			Array.from(
				screen.getByLabelText<HTMLSelectElement>("Priority").options,
			).map((option) => [option.value, option.textContent]),
		).toEqual([
			["", "No priority"],
			["low", "Low"],
			["medium", "Medium"],
			["high", "High"],
			["critical", "Critical"],
		]);
		expect(
			Array.from(
				screen.getByLabelText<HTMLSelectElement>("Story Points").options,
			).map((option) => [option.value, option.textContent]),
		).toEqual([
			["", "No estimation"],
			["1", "1"],
			["2", "2"],
			["3", "3"],
			["5", "5"],
			["8", "8"],
			["13", "13"],
		]);

		fireEvent.change(screen.getByLabelText("Task Title"), {
			target: { value: "Updated Task" },
		});
		fireEvent.change(screen.getByLabelText("Priority"), {
			target: { value: "high" },
		});
		fireEvent.change(screen.getByLabelText("Story Points"), {
			target: { value: "8" },
		});
		fireEvent.change(screen.getByLabelText("Workflow"), {
			target: { value: "done" },
		});
		fireEvent.change(screen.getByLabelText("Description"), {
			target: { value: "Updated notes" },
		});
		fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

		await screen.findByText("Task changes saved.");
		const [, init] = fetchSpy.mock.calls[0];
		expect(JSON.parse(String(init?.body))).toEqual({
			column_id: "done",
			acceptance_criteria: "Original criteria",
			description: "Updated notes",
			priority: "high",
			story_points: 8,
			tag: "Feature",
			title: "Updated Task",
		});
		expect(JSON.parse(String(init?.body))).not.toHaveProperty("status");
		expect(screen.getByLabelText<HTMLSelectElement>("Workflow").value).toBe(
			"done",
		);
		expect(
			queryClient.getQueryData<Task[]>(
				projectTasksQueryOptions("project-1").queryKey,
			)?.[0].title,
		).toBe("Updated Task");
	});

	it("shows legacy urgent priority as critical and can clear it", async () => {
		const { TaskDetailPage } = await import(
			"#/domains/workspace/ui/TaskDetailPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({ priority: "urgent" }),
		]);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column(),
		]);
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: "task-1",
					project_id: "project-1",
					title: "Original Task",
					column_id: "todo",
					priority: null,
					rank: "U",
					assignee_id: null,
					description: "Original notes",
					acceptance_criteria: "Original criteria",
					tag: "Feature",
					created_at: null,
					updated_at: null,
				}),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		renderTaskDetailPage(<TaskDetailPage />, queryClient);

		expect(screen.getByLabelText<HTMLSelectElement>("Priority").value).toBe(
			"critical",
		);
		fireEvent.change(screen.getByLabelText("Priority"), {
			target: { value: "" },
		});
		fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

		await screen.findByText("Task changes saved.");
		expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual(
			expect.objectContaining({ priority: null }),
		);
	});

	it("returns to Backlog when opened from Backlog context", async () => {
		const { TaskDetailPage } = await import(
			"#/domains/workspace/ui/TaskDetailPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task(),
		]);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column(),
		]);
		vi.stubGlobal("fetch", vi.fn<typeof fetch>());

		renderTaskDetailPage(<TaskDetailPage fromBacklog />, queryClient);

		expect(
			screen.getByRole("link", { name: "Back to the Backlog" }),
		).toHaveProperty(
			"href",
			expect.stringContaining("/projects/project-1/backlog"),
		);
		expect(screen.queryByRole("link", { name: "Back to Board" })).toBeNull();
	});

	it("keeps unsaved edits visible when saving fails", async () => {
		const { TaskDetailPage } = await import(
			"#/domains/workspace/ui/TaskDetailPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task(),
		]);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column(),
		]);
		vi.stubGlobal(
			"fetch",
			vi
				.fn<typeof fetch>()
				.mockResolvedValue(
					new Response(JSON.stringify({ detail: "Nope" }), { status: 500 }),
				),
		);

		renderTaskDetailPage(<TaskDetailPage />, queryClient);

		fireEvent.change(screen.getByLabelText("Task Title"), {
			target: { value: "Unsaved Task" },
		});
		fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

		await screen.findByText("Task could not be saved. Please try again.");
		await waitFor(() => {
			expect(screen.getByDisplayValue("Unsaved Task")).toBeTruthy();
		});
	});

	it("keeps unsaved edits visible when task details refetch", async () => {
		const { TaskDetailPage } = await import(
			"#/domains/workspace/ui/TaskDetailPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task(),
		]);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column(),
		]);

		renderTaskDetailPage(<TaskDetailPage />, queryClient);

		fireEvent.change(screen.getByLabelText("Task Title"), {
			target: { value: "Unsaved Task" },
		});
		act(() => {
			queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
				task({ title: "Server Refetch Task" }),
			]);
		});

		expect(screen.getByDisplayValue("Unsaved Task")).toBeTruthy();
		expect(screen.queryByDisplayValue("Server Refetch Task")).toBeNull();
	});

	it("opens Task Shaping Chat on edit without invoking AI and preserves chat state across close", async () => {
		const { TaskDetailPage } = await import(
			"#/domains/workspace/ui/TaskDetailPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task(),
		]);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column(),
		]);
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(taskShapingAgentCardResponse())
			.mockResolvedValueOnce(
				taskShapingTurnResponse({
					assistantMessage: "What outcome should this task achieve?",
					question: taskShapingQuestion(
						"What outcome should this task achieve?",
						"Describe the user-visible outcome",
					),
					fieldDrafts: { title: "Shaped Task" },
					metadata: { isReady: false, readinessReason: "Needs scope" },
				}),
			);
		vi.stubGlobal("fetch", fetchSpy);

		renderTaskDetailPage(<TaskDetailPage />, queryClient);

		fireEvent.click(screen.getByRole("button", { name: "Task Shaping Chat" }));
		expect(screen.getByText("Task Shaping Chat")).toBeTruthy();
		expect(fetchSpy).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "Start shaping" }));

		expect(
			await screen.findByText("What outcome should this task achieve?"),
		).toBeTruthy();
		expect(
			screen.queryByText(/Recommended: Describe the user-visible outcome/),
		).toBeNull();
		const recommendedOption = screen.getByRole<HTMLInputElement>("radio", {
			name: /describe the user-visible outcome/i,
		});
		const otherOption = screen.getByRole<HTMLInputElement>("radio", {
			name: /use another answer/i,
		});
		const sendButton = screen.getByRole<HTMLButtonElement>("button", {
			name: /send answer/i,
		});
		expect(recommendedOption.checked).toBe(false);
		expect(otherOption.checked).toBe(false);
		expect(sendButton.disabled).toBe(true);
		expect(screen.getByText("Recommended")).toBeTruthy();
		fireEvent.click(recommendedOption);
		expect(recommendedOption.checked).toBe(true);
		expect(otherOption.checked).toBe(false);
		expect(sendButton.disabled).toBe(false);
		expect(fetchSpy).toHaveBeenCalledTimes(2);

		fireEvent.click(
			screen.getByRole("button", { name: "Close Task Shaping Chat" }),
		);
		expect(
			screen.queryByText("What outcome should this task achieve?"),
		).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Task Shaping Chat" }));
		expect(
			screen.getByText("What outcome should this task achieve?"),
		).toBeTruthy();
	});

	it("sends edited task context and applies Task Shaping drafts without saving until submit", async () => {
		const { TaskDetailPage } = await import(
			"#/domains/workspace/ui/TaskDetailPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task(),
		]);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column(),
		]);
		const updatedTaskJson = {
			id: "task-1",
			project_id: "project-1",
			title: "Shaped Title",
			column_id: "todo",
			priority: "medium",
			story_points: 3,
			rank: "U",
			assignee_id: null,
			description: "Shaped description",
			acceptance_criteria: "- Shaped criteria",
			tag: "Feature",
			created_at: null,
			updated_at: null,
		};
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(taskShapingAgentCardResponse())
			.mockResolvedValueOnce(
				taskShapingTurnResponse({
					assistantMessage: "I drafted updates for the task fields.",
					fieldDrafts: {
						title: "Shaped Title",
						description: "Shaped description",
						acceptanceCriteria: "- Shaped criteria",
					},
					metadata: { isReady: true, readinessReason: "Drafts available" },
				}),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify(updatedTaskJson), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			)
			.mockResolvedValue(
				new Response(JSON.stringify([updatedTaskJson]), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			);
		vi.stubGlobal("fetch", fetchSpy);

		renderTaskDetailPage(<TaskDetailPage />, queryClient);

		fireEvent.change(screen.getByLabelText("Task Title"), {
			target: { value: "Edited unsaved title" },
		});
		fireEvent.change(screen.getByLabelText("Description"), {
			target: { value: "Edited unsaved description" },
		});
		fireEvent.change(screen.getByLabelText("Acceptance Criteria"), {
			target: { value: "Edited unsaved criteria" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Task Shaping Chat" }));
		fireEvent.click(screen.getByRole("button", { name: "Start shaping" }));

		await screen.findByText("I drafted updates for the task fields.");
		expect(screen.queryByText("Answer options")).toBeNull();
		expect(screen.queryByLabelText(/answer the focused question/i)).toBeNull();
		expect(screen.queryByRole("button", { name: /send answer/i })).toBeNull();
		const taskShapingCall = fetchSpy.mock.calls.find(([url]) =>
			String(url).endsWith("/a2a/task-shaping"),
		);
		expect(taskShapingCall).toBeTruthy();
		expect(
			findProjectTaskPayload(JSON.parse(String(taskShapingCall?.[1]?.body))),
		).toEqual({
			projectId: "project-1",
			taskShapingTurn: {
				form: {
					title: "Edited unsaved title",
					description: "Edited unsaved description",
					acceptanceCriteria: "Edited unsaved criteria",
					priority: "medium",
					storyPoints: 3,
					workflowColumn: "Ready",
					mode: "edit",
				},
				drafts: {},
				transcript: [],
			},
		});

		fireEvent.click(screen.getByRole("button", { name: "Apply Title draft" }));
		fireEvent.click(
			screen.getByRole("button", { name: "Apply Description draft" }),
		);
		fireEvent.click(
			screen.getByRole("button", {
				name: "Apply Acceptance Criteria draft",
			}),
		);
		expect(screen.getByDisplayValue("Shaped Title")).toBeTruthy();
		expect(screen.getByDisplayValue("Shaped description")).toBeTruthy();
		expect(screen.getByDisplayValue("- Shaped criteria")).toBeTruthy();
		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(
			queryClient.getQueryData<Task[]>(
				projectTasksQueryOptions("project-1").queryKey,
			)?.[0].title,
		).toBe("Original Task");
		expect(
			screen.getByRole("button", { name: "Generate with AI" }),
		).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

		await screen.findByText("Task changes saved.");
		const updateCall = fetchSpy.mock.calls.find(
			([url, init]) =>
				String(url).endsWith("/projects/project-1/tasks/task-1") &&
				init?.method === "PATCH",
		);
		expect(updateCall).toBeTruthy();
		expect(JSON.parse(String(updateCall?.[1]?.body))).toEqual({
			column_id: "todo",
			acceptance_criteria: "- Shaped criteria",
			description: "Shaped description",
			priority: "medium",
			story_points: 3,
			tag: "Feature",
			title: "Shaped Title",
		});
	});

	it("warns per stale Task Shaping draft and resets chat without changing edit fields", async () => {
		const { TaskDetailPage } = await import(
			"#/domains/workspace/ui/TaskDetailPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task(),
		]);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column(),
		]);
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(taskShapingAgentCardResponse())
			.mockResolvedValueOnce(
				taskShapingTurnResponse({
					assistantMessage: "Review edit drafts.",
					fieldDrafts: {
						title: "Edit title draft",
						description: "Edit description draft",
						acceptanceCriteria: "- Edit criterion",
					},
					metadata: { isReady: true, readinessReason: "Drafts available" },
				}),
			);
		vi.stubGlobal("fetch", fetchSpy);

		renderTaskDetailPage(<TaskDetailPage />, queryClient);
		fireEvent.click(screen.getByRole("button", { name: "Task Shaping Chat" }));
		fireEvent.click(screen.getByRole("button", { name: "Start shaping" }));
		await screen.findByText("Review edit drafts.");

		fireEvent.change(screen.getByLabelText("Task Title"), {
			target: { value: "Manual title edit" },
		});
		expect(
			screen.getByText(
				"This Title draft may be stale because Title changed after it was drafted. You can still apply it.",
			),
		).toBeTruthy();
		expect(
			screen.queryByText(
				"This Description draft may be stale because Description changed after it was drafted. You can still apply it.",
			),
		).toBeNull();
		expect(
			screen.queryByText(
				"This Acceptance Criteria draft may be stale because Acceptance Criteria changed after it was drafted. You can still apply it.",
			),
		).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Apply Title draft" }));
		expect(screen.getByDisplayValue("Edit title draft")).toBeTruthy();

		fireEvent.change(screen.getByLabelText("Description"), {
			target: { value: "Manual description edit" },
		});
		expect(
			screen.getByText(
				"This Description draft may be stale because Description changed after it was drafted. You can still apply it.",
			),
		).toBeTruthy();
		fireEvent.change(screen.getByLabelText("Acceptance Criteria"), {
			target: { value: "Manual criteria edit" },
		});
		expect(
			screen.getByText(
				"This Acceptance Criteria draft may be stale because Acceptance Criteria changed after it was drafted. You can still apply it.",
			),
		).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Reset chat" }));
		expect(screen.queryByText("Review edit drafts.")).toBeNull();
		expect(screen.queryByText(/Edit description draft/)).toBeNull();
		expect(screen.queryByText(/may be stale/)).toBeNull();
		expect(screen.getByLabelText<HTMLInputElement>("Task Title").value).toBe(
			"Edit title draft",
		);
		expect(
			screen.getByLabelText<HTMLTextAreaElement>("Description").value,
		).toBe("Manual description edit");
		expect(
			screen.getByLabelText<HTMLTextAreaElement>("Acceptance Criteria").value,
		).toBe("Manual criteria edit");
		expect(fetchSpy).toHaveBeenCalledTimes(2);
	});

	it("shows the edit acceptance criteria generator and prompts without context", async () => {
		const { TaskDetailPage } = await import(
			"#/domains/workspace/ui/TaskDetailPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({ title: "", description: "" }),
		]);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column(),
		]);
		const fetchSpy = vi.fn<typeof fetch>();
		vi.stubGlobal("fetch", fetchSpy);

		renderTaskDetailPage(<TaskDetailPage />, queryClient);

		expect(screen.getByLabelText("Acceptance Criteria")).toBeTruthy();
		const generateButton = screen.getByRole<HTMLButtonElement>("button", {
			name: "Generate with AI",
		});
		expect(generateButton.disabled).toBe(true);
		expect(
			screen.getByText(
				"Add a task title or description before generating acceptance criteria.",
			),
		).toBeTruthy();
		fireEvent.click(generateButton);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("streams generated criteria into the edit field without saving until submit", async () => {
		const { TaskDetailPage } = await import(
			"#/domains/workspace/ui/TaskDetailPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task(),
		]);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column(),
			column({ id: "done", name: "Released", position: 1 }),
		]);
		const updatedTaskJson = {
			id: "task-1",
			project_id: "project-1",
			title: "Original Task",
			column_id: "todo",
			priority: "medium",
			story_points: 3,
			rank: "U",
			assignee_id: null,
			description: "Original notes",
			acceptance_criteria: "- Generated one\n- Generated two",
			tag: "Feature",
			created_at: null,
			updated_at: null,
		};
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(a2aAgentCardResponse())
			.mockResolvedValueOnce(
				a2aStreamResponse("- Generated one", "\n- Generated two"),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify(updatedTaskJson), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			)
			.mockResolvedValue(
				new Response(JSON.stringify([updatedTaskJson]), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			);
		vi.stubGlobal("fetch", fetchSpy);

		renderTaskDetailPage(<TaskDetailPage />, queryClient);

		fireEvent.click(screen.getByRole("button", { name: "Generate with AI" }));

		await waitFor(() => {
			expect(
				screen.getByLabelText<HTMLTextAreaElement>("Acceptance Criteria").value,
			).toBe("- Generated one\n- Generated two");
		});
		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(String(fetchSpy.mock.calls[1][0])).toBe(
			"https://api.example.test/a2a/acceptance-criteria",
		);
		expect(
			new Headers(fetchSpy.mock.calls[1][1]?.headers).get("Authorization"),
		).toBe("Bearer task-token");
		expect(
			findProjectTaskPayload(
				JSON.parse(String(fetchSpy.mock.calls[1][1]?.body)),
			),
		).toEqual({
			projectId: "project-1",
			projectTask: {
				title: "Original Task",
				description: "Original notes",
				acceptanceCriteria: "Original criteria",
				priority: "medium",
				storyPoints: 3,
				tag: "Feature",
				workflowColumn: "Ready",
				mode: "edit",
			},
		});
		expect(screen.queryByText("Task changes saved.")).toBeNull();

		act(() => {
			queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
				task({ acceptanceCriteria: "Server refetch criteria" }),
			]);
		});
		expect(
			screen.getByLabelText<HTMLTextAreaElement>("Acceptance Criteria").value,
		).toBe("- Generated one\n- Generated two");

		fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

		await screen.findByText("Task changes saved.");
		const updateCall = fetchSpy.mock.calls.find(
			([url, init]) =>
				String(url).endsWith("/projects/project-1/tasks/task-1") &&
				init?.method === "PATCH",
		);
		expect(updateCall).toBeTruthy();
		expect(JSON.parse(String(updateCall?.[1]?.body))).toEqual({
			column_id: "todo",
			acceptance_criteria: "- Generated one\n- Generated two",
			description: "Original notes",
			priority: "medium",
			story_points: 3,
			tag: "Feature",
			title: "Original Task",
		});
	});

	it("recovers from failed edit criteria generation and allows manual save", async () => {
		const { TaskDetailPage } = await import(
			"#/domains/workspace/ui/TaskDetailPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task(),
		]);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column(),
		]);
		const updatedTaskJson = {
			id: "task-1",
			project_id: "project-1",
			title: "Original Task",
			column_id: "todo",
			priority: "medium",
			story_points: 3,
			rank: "U",
			assignee_id: null,
			description: "Original notes",
			acceptance_criteria: "Manual recovered criteria",
			tag: "Feature",
			created_at: null,
			updated_at: null,
		};
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(a2aAgentCardResponse())
			.mockResolvedValueOnce(failingA2aStreamResponse("- Partial edit"))
			.mockResolvedValueOnce(
				new Response(JSON.stringify(updatedTaskJson), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			)
			.mockResolvedValue(
				new Response(JSON.stringify([updatedTaskJson]), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			);
		vi.stubGlobal("fetch", fetchSpy);

		renderTaskDetailPage(<TaskDetailPage />, queryClient);

		fireEvent.click(screen.getByRole("button", { name: "Generate with AI" }));

		const acceptanceCriteria = screen.getByLabelText<HTMLTextAreaElement>(
			"Acceptance Criteria",
		);
		await waitFor(() =>
			expect(acceptanceCriteria.value).toBe("Original criteria"),
		);
		expect(
			screen.getByText(
				"Acceptance criteria could not be generated. Please try again.",
			),
		).toBeTruthy();
		expect(acceptanceCriteria.disabled).toBe(false);

		fireEvent.change(acceptanceCriteria, {
			target: { value: "Manual recovered criteria" },
		});
		fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

		await screen.findByText("Task changes saved.");
		const updateCall = fetchSpy.mock.calls.find(
			([url, init]) =>
				String(url).endsWith("/projects/project-1/tasks/task-1") &&
				init?.method === "PATCH",
		);
		expect(updateCall).toBeTruthy();
		expect(JSON.parse(String(updateCall?.[1]?.body))).toEqual({
			column_id: "todo",
			acceptance_criteria: "Manual recovered criteria",
			description: "Original notes",
			priority: "medium",
			story_points: 3,
			tag: "Feature",
			title: "Original Task",
		});
	});

	it("cancels edit criteria generation and unlocks the textarea", async () => {
		const { TaskDetailPage } = await import(
			"#/domains/workspace/ui/TaskDetailPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task(),
		]);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column(),
		]);
		const cancelSpy = vi.fn();
		let signal: AbortSignal | null = null;
		const fetchSpy = vi.fn<typeof fetch>((url, init) => {
			if (String(url).includes(".well-known/agent-card.json")) {
				return Promise.resolve(a2aAgentCardResponse());
			}
			signal = init?.signal as AbortSignal;
			return Promise.resolve(
				abortableA2aStreamResponse("- Partial edit generated", cancelSpy),
			);
		});
		vi.stubGlobal("fetch", fetchSpy);

		renderTaskDetailPage(<TaskDetailPage />, queryClient);

		fireEvent.click(screen.getByRole("button", { name: "Generate with AI" }));

		const acceptanceCriteria = screen.getByLabelText<HTMLTextAreaElement>(
			"Acceptance Criteria",
		);
		await waitFor(() => expect(acceptanceCriteria.disabled).toBe(true));
		await waitFor(() =>
			expect(acceptanceCriteria.value).toBe("- Partial edit generated"),
		);

		fireEvent.click(screen.getByRole("button", { name: /cancel generation/i }));

		await waitFor(() => expect(signal?.aborted).toBe(true));
		await waitFor(() => expect(acceptanceCriteria.disabled).toBe(false));
		expect(acceptanceCriteria.value).toBe("- Partial edit generated");
		expect(
			screen.getByRole("button", { name: "Generate with AI" }),
		).toBeTruthy();
	});

	it("blocks saving when workflow columns cannot be loaded", async () => {
		const { TaskDetailPage } = await import(
			"#/domains/workspace/ui/TaskDetailPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task(),
		]);
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValue(
				new Response(JSON.stringify({ detail: "No columns" }), { status: 500 }),
			);
		vi.stubGlobal("fetch", fetchSpy);

		renderTaskDetailPage(<TaskDetailPage />, queryClient);

		expect(
			await screen.findByText("Project workflow columns could not be loaded."),
		).toBeTruthy();
		await waitFor(() => {
			expect(
				screen.getByRole<HTMLButtonElement>("button", { name: /save changes/i })
					.disabled,
			).toBe(true);
		});
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});

	it("blocks saving when the task references a missing workflow column", async () => {
		const { TaskDetailPage } = await import(
			"#/domains/workspace/ui/TaskDetailPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({ columnId: "missing-column" }),
		]);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column(),
		]);
		const fetchSpy = vi.fn<typeof fetch>();
		vi.stubGlobal("fetch", fetchSpy);

		renderTaskDetailPage(<TaskDetailPage />, queryClient);

		expect(
			await screen.findByText(
				"This task references a workflow column that no longer exists. Choose a valid column after the task data is repaired.",
			),
		).toBeTruthy();
		expect(
			screen.getByRole<HTMLButtonElement>("button", { name: /save changes/i })
				.disabled,
		).toBe(true);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
