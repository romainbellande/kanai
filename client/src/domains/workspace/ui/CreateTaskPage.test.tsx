// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
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
	type ProjectColumn,
	projectColumnsQueryOptions,
	projectDoneColumnQueryOptions,
	projectQueryOptions,
} from "#/api/client";

const routerMocks = vi.hoisted(() => ({
	navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		params,
		to,
		...props
	}: AnchorHTMLAttributes<HTMLAnchorElement> & {
		children: ReactNode;
		params?: { projectId?: string };
		search?: Record<string, boolean | string>;
		to: string;
	}) => (
		<a
			href={params?.projectId ? to.replace("$projectId", params.projectId) : to}
			{...props}
		>
			{children}
		</a>
	),
	useNavigate: () => routerMocks.navigate,
	useParams: () => ({ projectId: "project-1" }),
}));

function getCreateTaskForm(): HTMLFormElement {
	const form = screen
		.getByRole("button", { name: /create task/i })
		.closest("form");

	if (!(form instanceof HTMLFormElement)) {
		throw new Error("Create task form was not rendered.");
	}

	return form;
}

function column(overrides: Partial<ProjectColumn>): ProjectColumn {
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

function renderWithQueryClient(
	ui: ReactNode,
	columns: ProjectColumn[] | null = [
		column({ id: "column-backlog", name: "Backlog", position: 0 }),
		column({ id: "column-review", name: "Review", position: 1 }),
	],
) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
		},
	});
	queryClient.setQueryData(currentUserQueryOptions().queryKey, {
		id: "user-1",
		first_name: "Task",
		last_name: "Creator",
	});
	queryClient.setQueryData(projectQueryOptions("project-1").queryKey, {
		id: "project-1",
		name: "API Project",
		code: "API",
		description: null,
		status: "active",
		ownerIds: [],
		memberIds: [],
		createdAt: null,
		updatedAt: null,
	});
	queryClient.setQueryData(
		projectDoneColumnQueryOptions("project-1").queryKey,
		{
			projectId: "project-1",
			doneColumnId: "column-done",
			requiresDesignation: false,
		},
	);
	if (columns !== null) {
		queryClient.setQueryData(
			projectColumnsQueryOptions("project-1").queryKey,
			columns,
		);
	}

	return render(
		<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
	);
}

describe("CreateTaskPage", () => {
	beforeEach(() => {
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

	it("renders loaded project columns and submits the selected column ID", async () => {
		const { CreateTaskPage } = await import(
			"#/domains/workspace/ui/CreateTaskPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: "task-1",
					project_id: "project-1",
					title: "Persist task",
					column_id: "column-review",
					priority: null,
					story_points: 5,
					rank: "0|hzzzzz:",
					assignee_id: null,
					description: "Task notes",
					acceptance_criteria: "Done means done",
					tag: null,
					created_at: null,
					updated_at: null,
				}),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<CreateTaskPage />);
		const workflowSelect = screen.getByLabelText(
			/workflow/i,
		) as HTMLSelectElement;
		const prioritySelect = screen.getByLabelText(
			/priority/i,
		) as HTMLSelectElement;
		const storyPointsSelect = screen.getByLabelText(
			/story points/i,
		) as HTMLSelectElement;
		expect(prioritySelect.value).toBe("");
		expect(
			Array.from(prioritySelect.options).map((option) => [
				option.value,
				option.textContent,
			]),
		).toEqual([
			["", "No priority"],
			["low", "Low"],
			["medium", "Medium"],
			["high", "High"],
			["critical", "Critical"],
		]);
		expect(storyPointsSelect.value).toBe("");
		expect(
			Array.from(storyPointsSelect.options).map((option) => [
				option.value,
				option.textContent,
			]),
		).toEqual([
			["", "No estimation"],
			["1", "1"],
			["2", "2"],
			["3", "3"],
			["5", "5"],
			["8", "8"],
			["13", "13"],
		]);
		expect(
			Array.from(workflowSelect.options).map((option) => [
				option.value,
				option.textContent,
			]),
		).toEqual([
			["column-backlog", "Backlog"],
			["column-review", "Review"],
		]);
		fireEvent.change(screen.getByLabelText(/task title/i), {
			target: { value: "Persist task" },
		});
		fireEvent.change(workflowSelect, {
			target: { value: "column-review" },
		});
		fireEvent.change(storyPointsSelect, {
			target: { value: "5" },
		});
		fireEvent.change(screen.getByLabelText(/description/i), {
			target: { value: "Task notes" },
		});
		fireEvent.change(screen.getByLabelText(/acceptance criteria/i), {
			target: { value: "Done means done" },
		});
		fireEvent.submit(getCreateTaskForm());

		await waitFor(() =>
			expect(
				fetchSpy.mock.calls.some(
					([url, init]) =>
						String(url).endsWith("/projects/project-1/tasks") &&
						init?.method === "POST",
				),
			).toBe(true),
		);
		const [, init] = fetchSpy.mock.calls.find(
			([url, init]) =>
				String(url).endsWith("/projects/project-1/tasks") &&
				init?.method === "POST",
		) ?? [null, undefined];
		expect(JSON.parse(String(init?.body))).toEqual({
			title: "Persist task",
			column_id: "column-review",
			story_points: 5,
			description: "Task notes",
			acceptance_criteria: "Done means done",
		});
		expect(routerMocks.navigate).toHaveBeenCalledWith({
			to: "/projects/$projectId",
			params: { projectId: "project-1" },
		});
	});

	it("renders and enables acceptance criteria generation from task context", async () => {
		const { CreateTaskPage } = await import(
			"#/domains/workspace/ui/CreateTaskPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		vi.stubGlobal("fetch", vi.fn<typeof fetch>());

		renderWithQueryClient(<CreateTaskPage />);
		const generateButton = screen.getByRole<HTMLButtonElement>("button", {
			name: /generate with ai/i,
		});
		expect(generateButton.disabled).toBe(true);
		expect(
			screen.getByText(
				"Add a task title or description before generating acceptance criteria.",
			),
		).toBeTruthy();

		fireEvent.change(screen.getByLabelText(/task title/i), {
			target: { value: "Generate criteria" },
		});

		expect(generateButton.disabled).toBe(false);
		expect(
			screen.queryByText(
				"Add a task title or description before generating acceptance criteria.",
			),
		).toBeNull();
	});

	it("streams criteria into the textarea and persists edits only on create", async () => {
		const { CreateTaskPage } = await import(
			"#/domains/workspace/ui/CreateTaskPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(a2aAgentCardResponse())
			.mockResolvedValueOnce(
				a2aStreamResponse("- Generated one", "\n- Generated two"),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						id: "task-1",
						project_id: "project-1",
						title: "Generated task",
						column_id: "column-review",
						priority: "medium",
						story_points: 3,
						rank: "0|hzzzzz:",
						assignee_id: null,
						description: "Task context",
						acceptance_criteria: "- Edited generated",
						tag: "AI",
						created_at: null,
						updated_at: null,
					}),
					{ headers: { "content-type": "application/json" }, status: 200 },
				),
			);
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<CreateTaskPage />);
		fireEvent.change(screen.getByLabelText(/task title/i), {
			target: { value: "Generated task" },
		});
		fireEvent.change(screen.getByLabelText(/workflow/i), {
			target: { value: "column-review" },
		});
		fireEvent.change(screen.getByLabelText(/priority/i), {
			target: { value: "medium" },
		});
		fireEvent.change(screen.getByLabelText(/story points/i), {
			target: { value: "3" },
		});
		fireEvent.change(screen.getByLabelText(/description/i), {
			target: { value: "Task context" },
		});
		fireEvent.change(screen.getByLabelText(/acceptance criteria/i), {
			target: { value: "Existing criteria" },
		});
		fireEvent.change(screen.getByLabelText(/tag/i), {
			target: { value: "AI" },
		});

		fireEvent.click(screen.getByRole("button", { name: /generate with ai/i }));

		const acceptanceCriteria = screen.getByLabelText(
			/acceptance criteria/i,
		) as HTMLTextAreaElement;
		await waitFor(() =>
			expect(acceptanceCriteria.value).toBe("- Generated one\n- Generated two"),
		);
		expect(acceptanceCriteria.disabled).toBe(false);

		fireEvent.change(acceptanceCriteria, {
			target: { value: "- Edited generated" },
		});
		fireEvent.submit(getCreateTaskForm());

		await waitFor(() =>
			expect(
				fetchSpy.mock.calls.some(
					([url, init]) =>
						String(url).endsWith("/projects/project-1/tasks") &&
						init?.method === "POST",
				),
			).toBe(true),
		);
		const [, init] = fetchSpy.mock.calls.find(
			([url, init]) =>
				String(url).endsWith("/projects/project-1/tasks") &&
				init?.method === "POST",
		) ?? [null, undefined];
		expect(JSON.parse(String(init?.body))).toEqual({
			title: "Generated task",
			column_id: "column-review",
			priority: "medium",
			story_points: 3,
			description: "Task context",
			acceptance_criteria: "- Edited generated",
			tag: "AI",
		});
	});

	it("recovers from failed criteria generation and allows manual create", async () => {
		const { CreateTaskPage } = await import(
			"#/domains/workspace/ui/CreateTaskPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(a2aAgentCardResponse())
			.mockResolvedValueOnce(failingA2aStreamResponse("- Partial generated"))
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						id: "task-1",
						project_id: "project-1",
						title: "Recovered task",
						column_id: "column-review",
						priority: null,
						story_points: null,
						rank: "0|hzzzzz:",
						assignee_id: null,
						description: "Task context",
						acceptance_criteria: "Manual recovered criteria",
						tag: null,
						created_at: null,
						updated_at: null,
					}),
					{ headers: { "content-type": "application/json" }, status: 200 },
				),
			);
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<CreateTaskPage />);
		fireEvent.change(screen.getByLabelText(/task title/i), {
			target: { value: "Recovered task" },
		});
		fireEvent.change(screen.getByLabelText(/workflow/i), {
			target: { value: "column-review" },
		});
		fireEvent.change(screen.getByLabelText(/description/i), {
			target: { value: "Task context" },
		});
		fireEvent.change(screen.getByLabelText(/acceptance criteria/i), {
			target: { value: "Original criteria" },
		});

		fireEvent.click(screen.getByRole("button", { name: /generate with ai/i }));

		const acceptanceCriteria =
			screen.getByLabelText<HTMLTextAreaElement>(/acceptance criteria/i);
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
		fireEvent.submit(getCreateTaskForm());

		await waitFor(() =>
			expect(
				fetchSpy.mock.calls.some(
					([url, init]) =>
						String(url).endsWith("/projects/project-1/tasks") &&
						init?.method === "POST",
				),
			).toBe(true),
		);
		const [, init] = fetchSpy.mock.calls.find(
			([url, init]) =>
				String(url).endsWith("/projects/project-1/tasks") &&
				init?.method === "POST",
		) ?? [null, undefined];
		expect(JSON.parse(String(init?.body))).toEqual({
			title: "Recovered task",
			column_id: "column-review",
			description: "Task context",
			acceptance_criteria: "Manual recovered criteria",
		});
	});

	it("cancels create criteria generation and unlocks the textarea", async () => {
		const { CreateTaskPage } = await import(
			"#/domains/workspace/ui/CreateTaskPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		const cancelSpy = vi.fn();
		let signal: AbortSignal | null = null;
		const fetchSpy = vi.fn<typeof fetch>((url, init) => {
			if (String(url).includes(".well-known/agent-card.json")) {
				return Promise.resolve(a2aAgentCardResponse());
			}
			signal = init?.signal as AbortSignal;
			return Promise.resolve(
				abortableA2aStreamResponse("- Partial generated", cancelSpy),
			);
		});
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<CreateTaskPage />);
		fireEvent.change(screen.getByLabelText(/task title/i), {
			target: { value: "Generated task" },
		});

		fireEvent.click(screen.getByRole("button", { name: /generate with ai/i }));

		const acceptanceCriteria =
			screen.getByLabelText<HTMLTextAreaElement>(/acceptance criteria/i);
		await waitFor(() => expect(acceptanceCriteria.disabled).toBe(true));
		await waitFor(() =>
			expect(acceptanceCriteria.value).toBe("- Partial generated"),
		);

		fireEvent.click(screen.getByRole("button", { name: /cancel generation/i }));

		await waitFor(() => expect(signal?.aborted).toBe(true));
		await waitFor(() => expect(acceptanceCriteria.disabled).toBe(false));
		expect(acceptanceCriteria.value).toBe("- Partial generated");
		expect(
			screen.getByRole("button", { name: /generate with ai/i }),
		).toBeTruthy();
	});

	it("uses the source board column as the initial workflow column", async () => {
		const { CreateTaskPage } = await import(
			"#/domains/workspace/ui/CreateTaskPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: "task-1",
					project_id: "project-1",
					title: "Column task",
					column_id: "column-review",
					priority: null,
					rank: "0|hzzzzz:",
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

		renderWithQueryClient(<CreateTaskPage initialColumnId="column-review" />);
		await waitFor(() =>
			expect(
				(screen.getByLabelText(/workflow/i) as HTMLSelectElement).value,
			).toBe("column-review"),
		);
		fireEvent.change(screen.getByLabelText(/task title/i), {
			target: { value: "Column task" },
		});
		fireEvent.submit(getCreateTaskForm());

		await waitFor(() =>
			expect(
				fetchSpy.mock.calls.some(
					([url, init]) =>
						String(url).endsWith("/projects/project-1/tasks") &&
						init?.method === "POST",
				),
			).toBe(true),
		);
		const [, init] = fetchSpy.mock.calls.find(
			([url, init]) =>
				String(url).endsWith("/projects/project-1/tasks") &&
				init?.method === "POST",
		) ?? [null, undefined];
		expect(JSON.parse(String(init?.body))).toEqual({
			title: "Column task",
			column_id: "column-review",
		});
	});

	it("blocks submission when workflow columns are empty", async () => {
		const { CreateTaskPage } = await import(
			"#/domains/workspace/ui/CreateTaskPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		const fetchSpy = vi.fn<typeof fetch>();
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<CreateTaskPage />, []);
		fireEvent.change(screen.getByLabelText(/task title/i), {
			target: { value: "Blocked task" },
		});
		fireEvent.submit(getCreateTaskForm());

		expect(
			screen.getAllByText(
				"This project has no workflow columns. Add a workflow column before creating tasks.",
			),
		).toHaveLength(2);
		expect(
			(
				screen.getByRole("button", {
					name: /create task/i,
				}) as HTMLButtonElement
			).disabled,
		).toBe(true);
		expect(
			fetchSpy.mock.calls.some(
				([url, init]) =>
					String(url).endsWith("/projects/project-1/tasks") &&
					init?.method === "POST",
			),
		).toBe(false);
	});

	it("blocks submission when workflow columns cannot be loaded", async () => {
		const { CreateTaskPage } = await import(
			"#/domains/workspace/ui/CreateTaskPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValue(
				new Response(JSON.stringify({ detail: "No columns" }), { status: 500 }),
			);
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<CreateTaskPage />, null);

		expect(
			await screen.findByText("Project workflow columns could not be loaded."),
		).toBeTruthy();
		expect(
			(
				screen.getByRole("button", {
					name: /create task/i,
				}) as HTMLButtonElement
			).disabled,
		).toBe(true);
		fireEvent.submit(getCreateTaskForm());
		expect(
			fetchSpy.mock.calls.some(
				([url, init]) =>
					String(url).endsWith("/projects/project-1/tasks") &&
					init?.method === "POST",
			),
		).toBe(false);
	});

	it("shows validation failure without submitting", async () => {
		const { CreateTaskPage } = await import(
			"#/domains/workspace/ui/CreateTaskPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		const fetchSpy = vi.fn<typeof fetch>();
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<CreateTaskPage />);
		fireEvent.submit(getCreateTaskForm());

		expect(await screen.findByText("Task title is required.")).toBeTruthy();
		expect(
			fetchSpy.mock.calls.some(
				([url, init]) =>
					String(url).endsWith("/projects/project-1/tasks") &&
					init?.method === "POST",
			),
		).toBe(false);
	});

	it("keeps form input and shows an inline error when creation fails", async () => {
		const { CreateTaskPage } = await import(
			"#/domains/workspace/ui/CreateTaskPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		vi.stubGlobal(
			"fetch",
			vi
				.fn<typeof fetch>()
				.mockResolvedValue(
					new Response(JSON.stringify({ detail: "Nope" }), { status: 500 }),
				),
		);

		renderWithQueryClient(<CreateTaskPage />);
		const titleInput = screen.getByLabelText(/task title/i) as HTMLInputElement;
		fireEvent.change(titleInput, { target: { value: "Failed Task" } });
		fireEvent.submit(getCreateTaskForm());

		expect(
			await screen.findByText("Task could not be created. Please try again."),
		).toBeTruthy();
		expect(titleInput.value).toBe("Failed Task");
		expect(routerMocks.navigate).not.toHaveBeenCalled();
	});

	it("creates Backlog tasks with full details through the Backlog API", async () => {
		const { CreateTaskPage } = await import(
			"#/domains/workspace/ui/CreateTaskPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: "task-1",
					project_id: "project-1",
					title: "Backlog task",
					column_id: "column-todo",
					priority: "high",
					rank: "0|hzzzzz:",
					backlog_rank: "F",
					assignee_id: null,
					description: "Backlog notes",
					acceptance_criteria: "Backlog criteria",
					tag: "UX",
					created_at: null,
					updated_at: null,
				}),
				{ headers: { "content-type": "application/json" }, status: 201 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<CreateTaskPage createInBacklog />, [
			column({ id: "column-todo", name: "To Do", position: 0 }),
			column({ id: "column-done", name: "Done", position: 1 }),
		]);

		expect(screen.getByText("Destination")).toBeTruthy();
		expect(screen.getByText("Backlog")).toBeTruthy();
		expect(screen.queryByLabelText(/workflow/i)).toBeNull();
		fireEvent.change(screen.getByLabelText(/task title/i), {
			target: { value: "Backlog task" },
		});
		fireEvent.change(screen.getByLabelText(/priority/i), {
			target: { value: "high" },
		});
		fireEvent.change(screen.getByLabelText(/description/i), {
			target: { value: "Backlog notes" },
		});
		fireEvent.change(screen.getByLabelText(/acceptance criteria/i), {
			target: { value: "Backlog criteria" },
		});
		fireEvent.change(screen.getByLabelText(/tag/i), {
			target: { value: "UX" },
		});
		fireEvent.submit(getCreateTaskForm());

		await waitFor(() =>
			expect(
				fetchSpy.mock.calls.some(
					([url, init]) =>
						String(url).endsWith("/projects/project-1/backlog/tasks") &&
						init?.method === "POST",
				),
			).toBe(true),
		);
		const [, init] = fetchSpy.mock.calls.find(
			([url, init]) =>
				String(url).endsWith("/projects/project-1/backlog/tasks") &&
				init?.method === "POST",
		) ?? [null, undefined];
		expect(JSON.parse(String(init?.body))).toEqual({
			title: "Backlog task",
			column_id: "column-todo",
			priority: "high",
			description: "Backlog notes",
			acceptance_criteria: "Backlog criteria",
			tag: "UX",
		});
		expect(routerMocks.navigate).toHaveBeenCalledWith({
			to: "/projects/$projectId/backlog",
			params: { projectId: "project-1" },
		});
	});

	it("blocks Backlog task creation when no non-Done workflow column exists", async () => {
		const { CreateTaskPage } = await import(
			"#/domains/workspace/ui/CreateTaskPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		const fetchSpy = vi.fn<typeof fetch>();
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<CreateTaskPage createInBacklog />, [
			column({ id: "column-done", name: "Done", position: 0 }),
		]);

		expect(
			screen.getByText(
				"A non-Done workflow column is required before creating Backlog tasks.",
			),
		).toBeTruthy();
		expect(
			screen.getByRole<HTMLButtonElement>("button", { name: /create task/i })
				.disabled,
		).toBe(true);
		fireEvent.submit(getCreateTaskForm());
		expect(
			fetchSpy.mock.calls.some(
				([url, init]) =>
					String(url).endsWith("/projects/project-1/backlog/tasks") &&
					init?.method === "POST",
			),
		).toBe(false);
	});
});
