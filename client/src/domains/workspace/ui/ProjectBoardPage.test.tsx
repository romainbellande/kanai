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
	type ProjectDoneColumn,
	type ProjectSprint,
	projectAccessUsersQueryKey,
	projectActiveSprintQueryOptions,
	projectBacklogQueryOptions,
	projectChatMessagesQueryOptions,
	projectColumnsQueryOptions,
	projectDoneColumnQueryOptions,
	projectQueryOptions,
	projectSprintHistoryQueryOptions,
	projectTasksQueryOptions,
	type Task,
	type UserProfile,
} from "#/api/client";

let projectSearch: { view?: "history" } = {};

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		params,
		search,
		to,
		...props
	}: AnchorHTMLAttributes<HTMLAnchorElement> & {
		children: ReactNode;
		params?: { columnId?: string; projectId?: string; taskId?: string };
		search?: Record<string, boolean | string>;
		to: string;
	}) => {
		const href = params?.projectId
			? to
					.replace("$projectId", params.projectId)
					.replace("$columnId", params.columnId ?? "")
					.replace("$taskId", "taskId" in params ? String(params.taskId) : "")
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
	useParams: () => ({ projectId: "project-1" }),
	useSearch: () => projectSearch,
}));

function task(overrides: Partial<Task>): Task {
	return {
		id: "task-1",
		projectId: "project-1",
		sprintId: "sprint-1",
		title: "Task",
		columnId: "column-todo",
		priority: "medium",
		storyPoints: null,
		rank: "U",
		backlogRank: null,
		assigneeId: null,
		description: null,
		acceptanceCriteria: null,
		tag: null,
		createdAt: null,
		updatedAt: null,
		...overrides,
	};
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

function project(overrides: Partial<Project> = {}): Project {
	return {
		id: "project-1",
		name: "Project",
		code: "PRJ",
		description: null,
		status: "active",
		ownerIds: [],
		memberIds: [],
		createdAt: null,
		updatedAt: null,
		...overrides,
	};
}

function activeSprint(overrides: Partial<ProjectSprint> = {}): ProjectSprint {
	return {
		id: "sprint-1",
		projectId: "project-1",
		name: "Sprint 1",
		lifecycleState: "active",
		plannedStartDate: "2026-06-01",
		plannedEndDate: "2026-06-14",
		goal: null,
		closedAt: null,
		createdAt: null,
		updatedAt: null,
		...overrides,
	};
}

function doneColumn(
	overrides: Partial<ProjectDoneColumn> = {},
): ProjectDoneColumn {
	return {
		projectId: "project-1",
		doneColumnId: "column-done",
		requiresDesignation: false,
		...overrides,
	};
}

function userProfile(overrides: Partial<UserProfile>): UserProfile {
	return {
		display_name: undefined,
		external_id: "user@example.test",
		first_name: undefined,
		id: "user-1",
		last_name: undefined,
		...overrides,
	};
}

function chatMessageJson(index: number) {
	return {
		author: {
			deleted: false,
			display_name: "Jane Owner",
			id: "owner-1",
			initials: "JO",
		},
		body: `Message ${index}`,
		created_at: new Date(Date.UTC(2026, 0, 1, 9, index)).toISOString(),
		id: `message-${index}`,
		project_id: "project-1",
	};
}

function seedProjectBoardQueries(queryClient: QueryClient) {
	queryClient.setQueryData(currentUserQueryOptions().queryKey, {
		id: "owner-1",
		first_name: "Jane",
		last_name: "Doe",
	});
	queryClient.setQueryData(
		projectQueryOptions("project-1").queryKey,
		project({ name: "API Board", ownerIds: ["owner-1"] }),
	);
	queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, []);
	queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
		column({ id: "column-todo", name: "Backlog", position: 0 }),
	]);
	queryClient.setQueryData(
		projectAccessUsersQueryKey("project-1", ["owner-1"]),
		[
			userProfile({
				display_name: "Jane Owner",
				id: "owner-1",
			}),
		],
	);
}

function setChatScrollMetrics(
	container: HTMLElement,
	metrics: { clientHeight: number; scrollHeight: number; scrollTop: number },
) {
	Object.defineProperty(container, "clientHeight", {
		configurable: true,
		value: metrics.clientHeight,
	});
	Object.defineProperty(container, "scrollHeight", {
		configurable: true,
		value: metrics.scrollHeight,
	});
	container.scrollTop = metrics.scrollTop;
}

function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
		},
	});
}

function renderWithQueryClient(
	ui: ReactNode,
	queryClient = createTestQueryClient(),
) {
	if (
		queryClient.getQueryData(
			projectActiveSprintQueryOptions("project-1").queryKey,
		) === undefined
	) {
		queryClient.setQueryData(
			projectActiveSprintQueryOptions("project-1").queryKey,
			activeSprint(),
		);
	}
	if (
		queryClient.getQueryData(
			projectDoneColumnQueryOptions("project-1").queryKey,
		) === undefined
	) {
		queryClient.setQueryData(
			projectDoneColumnQueryOptions("project-1").queryKey,
			doneColumn(),
		);
	}
	if (
		queryClient.getQueryData(
			projectBacklogQueryOptions("project-1").queryKey,
		) === undefined
	) {
		queryClient.setQueryData(
			projectBacklogQueryOptions("project-1").queryKey,
			[],
		);
	}

	return render(
		<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
	);
}

class FakeWebSocket {
	static readonly OPEN = 1;
	static readonly CLOSED = 3;
	static instances: FakeWebSocket[] = [];

	readonly sentMessages: string[] = [];
	readyState = FakeWebSocket.OPEN;
	private readonly listeners = new Map<
		string,
		((event?: { data: string }) => void)[]
	>();

	constructor(
		readonly url: string | URL,
		readonly protocols?: string | string[],
	) {
		FakeWebSocket.instances.push(this);
	}

	addEventListener(
		eventName: string,
		listener: (event?: { data: string }) => void,
	) {
		this.listeners.set(eventName, [
			...(this.listeners.get(eventName) ?? []),
			listener,
		]);
	}

	send(message: string) {
		this.sentMessages.push(message);
	}

	close() {
		this.readyState = FakeWebSocket.CLOSED;
	}

	emitMessage(payload: unknown) {
		for (const listener of this.listeners.get("message") ?? []) {
			listener({ data: JSON.stringify(payload) });
		}
	}

	emitClose() {
		this.readyState = FakeWebSocket.CLOSED;
		for (const listener of this.listeners.get("close") ?? []) {
			listener();
		}
	}
}

describe("ProjectBoardPage", () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		window.sessionStorage.clear();
	});

	beforeEach(() => {
		projectSearch = {};
		FakeWebSocket.instances = [];
		vi.stubGlobal("WebSocket", FakeWebSocket);
	});

	it("groups API tasks into stable columns and ignores other projects", async () => {
		const { groupTasksByColumn } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const columns = groupTasksByColumn(
			[
				task({
					id: "todo-task",
					title: "Todo",
					columnId: "column-todo",
					rank: "U",
				}),
				task({ id: "doing-task", title: "Doing", columnId: "column-doing" }),
				task({ id: "done-task", title: "Done", columnId: "column-done" }),
				task({
					id: "unknown-task",
					title: "Unknown",
					columnId: "missing-column",
					rank: "j",
				}),
				task({ id: "other-task", projectId: "project-2", title: "Other" }),
			],
			"project-1",
			[
				column({ id: "column-todo", name: "To Do", position: 0 }),
				column({ id: "column-doing", name: "Doing", position: 1 }),
				column({ id: "column-done", name: "Done", position: 2 }),
			],
		);

		expect(
			columns.map((column) => column.cards.map((card) => card.id)),
		).toEqual([["todo-task"], ["doing-task"], ["done-task"]]);
	});

	it("sorts cards by rank and computes fractional ranks", async () => {
		const { getRankForDestination, groupTasksByColumn, rankBetween } =
			await import("#/domains/workspace/ui/ProjectBoardPage");
		const columns = groupTasksByColumn(
			[
				task({ id: "last", title: "Last", rank: "j" }),
				task({ id: "first", title: "First", rank: "U" }),
			],
			"project-1",
			[column({ id: "column-todo", name: "To Do", position: 0 })],
		);

		const middleRank = rankBetween("U", "j");

		expect(columns[0].cards.map((card) => card.id)).toEqual(["first", "last"]);
		expect(middleRank > "U").toBe(true);
		expect(middleRank < "j").toBe(true);
		expect(getRankForDestination(columns[0].cards, 1)).toBe(middleRank);
	});

	it("computes same-column insertion indexes above and below target cards", async () => {
		const { getDestinationIndex } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const cards = [
			task({ id: "first", rank: "F" }),
			task({ id: "middle", rank: "U" }),
			task({ id: "last", rank: "j" }),
		];

		expect(
			getDestinationIndex({
				cards,
				sourceTaskId: "last",
				targetTaskId: "first",
				closestEdge: "top",
			}),
		).toBe(0);
		expect(
			getDestinationIndex({
				cards,
				sourceTaskId: "last",
				targetTaskId: "first",
				closestEdge: "bottom",
			}),
		).toBe(1);
		expect(
			getDestinationIndex({
				cards,
				sourceTaskId: "first",
				targetTaskId: "last",
				closestEdge: "top",
			}),
		).toBe(1);
		expect(
			getDestinationIndex({
				cards,
				sourceTaskId: "first",
				targetTaskId: "last",
				closestEdge: "bottom",
			}),
		).toBe(2);
	});

	it("detects only column backgrounds as append drop targets", async () => {
		const { getColumnAppendDropIndicator } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);

		expect(
			getColumnAppendDropIndicator({ type: "column", columnId: "column-done" }),
		).toEqual({ columnId: "column-done" });
		expect(
			getColumnAppendDropIndicator({
				type: "card",
				columnId: "column-done",
				taskId: "task-1",
			}),
		).toBeNull();
		expect(getColumnAppendDropIndicator({ type: "column" })).toBeNull();
	});

	it("renders API project details and API task cards", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "user-1",
			first_name: "Jane",
			last_name: "Doe",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board" }),
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({
				id: "todo-task",
				title: "API Todo",
				columnId: "column-todo",
				storyPoints: 3,
			}),
			task({ id: "doing-task", title: "API Doing", columnId: "column-doing" }),
			task({ id: "done-task", title: "API Done", columnId: "column-done" }),
			task({
				id: "backlog-task",
				title: "Backlog only",
				sprintId: null,
				columnId: "column-todo",
			}),
			task({
				id: "other-task",
				projectId: "project-2",
				title: "Other Project",
			}),
		]);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
			column({ id: "column-doing", name: "Review", position: 1 }),
			column({ id: "column-done", name: "Shipped", position: 2 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(screen.getByText("Main Board: API Board")).toBeTruthy();
		expect(screen.getByText("API Todo")).toBeTruthy();
		expect(
			(screen.getByRole("link", { name: /API Todo/i }) as HTMLAnchorElement)
				.href,
		).toContain("/projects/project-1/tasks/todo-task");
		expect(screen.getByText("API Doing")).toBeTruthy();
		expect(screen.getByText("API Done")).toBeTruthy();
		expect(screen.getByText("3 pts")).toBeTruthy();
		expect(screen.getAllByText("No estimation").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Backlog").length).toBeGreaterThan(0);
		expect(screen.getByText("Review")).toBeTruthy();
		expect(screen.getByText("Shipped")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Board" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Calendar" })).toBeNull();
		expect(screen.getByRole("button", { name: "Filter" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Invite" })).toBeTruthy();
		expect(screen.queryByText("Other Project")).toBeNull();
		expect(screen.queryByText("Backlog only")).toBeNull();
		expect(screen.queryByText("Security Audit Phase 1")).toBeNull();
	});

	it("updates task card Story Point badges when saved task data changes", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board" }),
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "To Do", position: 0 }),
		]);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({
				id: "todo-task",
				title: "Estimate me",
				columnId: "column-todo",
				storyPoints: null,
			}),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(screen.getByText("No estimation")).toBeTruthy();
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({
				id: "todo-task",
				title: "Estimate me",
				columnId: "column-todo",
				storyPoints: 13,
			}),
		]);
		cleanup();
		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(screen.getByText("13 pts")).toBeTruthy();
	});

	it("shows a no-active-sprint planning state and creates the first sprint", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "sprint-token" }),
		);
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "owner-1",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board", ownerIds: ["owner-1"] }),
		);
		queryClient.setQueryData(
			projectActiveSprintQueryOptions("project-1").queryKey,
			null,
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({ id: "todo-task", title: "Hidden until sprint exists" }),
		]);
		queryClient.setQueryData(projectBacklogQueryOptions("project-1").queryKey, [
			task({
				id: "initial-task",
				title: "Initial backlog task",
				sprintId: null,
				backlogRank: "F",
			}),
		]);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);
		const sprintResponse = {
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
		};
		const fetchSpy = vi.fn<typeof fetch>().mockImplementation((url, init) => {
			if (String(url).endsWith("/projects/project-1/sprints/history")) {
				return Promise.resolve(
					new Response(JSON.stringify([]), {
						headers: { "content-type": "application/json" },
						status: 200,
					}),
				);
			}
			return Promise.resolve(
				new Response(JSON.stringify(sprintResponse), {
					headers: { "content-type": "application/json" },
					status: init?.method === "POST" ? 201 : 200,
				}),
			);
		});
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(screen.getByText("No active sprint")).toBeTruthy();
		expect(screen.getByRole("link", { name: /view backlog/i })).toHaveProperty(
			"href",
			expect.stringContaining("/projects/project-1/backlog"),
		);
		expect(screen.queryByText("Hidden until sprint exists")).toBeNull();

		fireEvent.change(screen.getByLabelText("Planned start"), {
			target: { value: "2026-06-01" },
		});
		fireEvent.change(screen.getByLabelText("Planned end"), {
			target: { value: "2026-06-14" },
		});
		fireEvent.change(screen.getByLabelText("Sprint goal"), {
			target: { value: "Planning goal" },
		});
		fireEvent.click(screen.getByLabelText("Initial backlog task"));
		fireEvent.click(
			screen.getAllByRole("button", { name: "Create Sprint" })[1],
		);

		await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
		const [, createSprintInit] = fetchSpy.mock.calls.find(
			([url, init]) =>
				url === "https://api.example.test/projects/project-1/sprints" &&
				init?.method === "POST",
		) ?? [null, undefined];
		expect(createSprintInit?.method).toBe("POST");
		expect(JSON.parse(String(createSprintInit?.body))).toEqual({
			planned_start_date: "2026-06-01",
			planned_end_date: "2026-06-14",
			goal: "Planning goal",
			task_ids: ["initial-task"],
		});
		await waitFor(() => expect(screen.getByText("Sprint 1")).toBeTruthy());
		expect(screen.getByText("Planning goal")).toBeTruthy();
		expect(screen.getByText("Hidden until sprint exists")).toBeTruthy();
	});

	it("keeps sprint creation disabled for non-owner members without an active sprint", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "member-1",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({
				name: "API Board",
				ownerIds: ["owner-1"],
				memberIds: ["member-1"],
			}),
		);
		queryClient.setQueryData(
			projectActiveSprintQueryOptions("project-1").queryKey,
			null,
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(screen.getByText("No active sprint")).toBeTruthy();
		expect(
			screen.getByText("Only project owners can create lifecycle sprints."),
		).toBeTruthy();
		for (const button of screen.getAllByRole("button", {
			name: "Create Sprint",
		})) {
			expect(button).toHaveProperty("disabled", true);
		}
		expect(screen.getByRole("link", { name: /view backlog/i })).toBeTruthy();
	});

	it("suggests the next sprint dates from the latest closed planned timebox", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "owner-1",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board", ownerIds: ["owner-1"] }),
		);
		queryClient.setQueryData(
			projectActiveSprintQueryOptions("project-1").queryKey,
			null,
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(
			projectBacklogQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(
			projectSprintHistoryQueryOptions("project-1").queryKey,
			[
				{
					sprint: activeSprint({
						id: "closed-sprint",
						lifecycleState: "closed",
						plannedStartDate: "2026-06-01",
						plannedEndDate: "2026-06-14",
						closedAt: new Date("2026-06-30T20:00:00Z"),
					}),
					finishedCount: 0,
					unfinishedCount: 0,
					unfinishedTasks: [],
					carryoverStatement:
						"Unfinished tasks will move to the top of the Backlog.",
					snapshots: [],
				},
			],
		);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		await waitFor(() =>
			expect(screen.getByLabelText("Planned start")).toHaveProperty(
				"value",
				"2026-06-15",
			),
		);
		expect(screen.getByLabelText("Planned end")).toHaveProperty(
			"value",
			"2026-06-28",
		);
	});

	it("surfaces sprint overlap validation from the API", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "sprint-token" }),
		);
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "owner-1",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board", ownerIds: ["owner-1"] }),
		);
		queryClient.setQueryData(
			projectActiveSprintQueryOptions("project-1").queryKey,
			null,
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(
			projectBacklogQueryOptions("project-1").queryKey,
			[],
		);
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					detail: "Sprint timebox overlaps an existing sprint",
				}),
				{ headers: { "content-type": "application/json" }, status: 422 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);
		fireEvent.click(
			screen.getAllByRole("button", { name: "Create Sprint" })[1],
		);

		await waitFor(() =>
			expect(
				screen.getByText("Sprint timebox overlaps an existing sprint"),
			).toBeTruthy(),
		);
	});

	it("lets project owners edit the active sprint dates and goal", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "sprint-token" }),
		);
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "owner-1",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board", ownerIds: ["owner-1"] }),
		);
		queryClient.setQueryData(
			projectActiveSprintQueryOptions("project-1").queryKey,
			activeSprint({ goal: "Initial goal" }),
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: "sprint-1",
					project_id: "project-1",
					name: "Sprint 1",
					lifecycle_state: "active",
					planned_start_date: "2026-06-02",
					planned_end_date: "2026-06-15",
					goal: "Updated goal",
					closed_at: null,
					created_at: null,
					updated_at: null,
				}),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		fireEvent.click(screen.getByRole("button", { name: /edit sprint/i }));
		fireEvent.change(screen.getByLabelText("Planned start"), {
			target: { value: "2026-06-02" },
		});
		fireEvent.change(screen.getByLabelText("Planned end"), {
			target: { value: "2026-06-15" },
		});
		fireEvent.change(screen.getByLabelText("Sprint goal"), {
			target: { value: "Updated goal" },
		});
		fireEvent.click(screen.getByRole("button", { name: /save sprint/i }));

		await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
		expect(fetchSpy.mock.calls[0][0]).toBe(
			"https://api.example.test/projects/project-1/sprints/active",
		);
		expect(fetchSpy.mock.calls[0][1]?.method).toBe("PATCH");
		expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({
			planned_start_date: "2026-06-02",
			planned_end_date: "2026-06-15",
			goal: "Updated goal",
		});
		await waitFor(() => expect(screen.getByText("Updated goal")).toBeTruthy());
		expect(screen.queryByRole("form", { name: /edit sprint/i })).toBeNull();
	});

	it("shows Current Sprint point progress without a visible percentage", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board" }),
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "To Do", position: 0 }),
			column({ id: "column-done", name: "Done", position: 1 }),
		]);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({
				id: "done-task",
				title: "Done estimated",
				columnId: "column-done",
				storyPoints: 5,
			}),
			task({
				id: "todo-task",
				title: "Todo estimated",
				columnId: "column-todo",
				storyPoints: 3,
			}),
			task({
				id: "unestimated-task",
				title: "Unestimated",
				columnId: "column-todo",
				storyPoints: null,
			}),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(screen.getByText("Story Point progress")).toBeTruthy();
		expect(screen.getByText("5 pts done")).toBeTruthy();
		expect(screen.getByText("3 pts remaining")).toBeTruthy();
		expect(screen.getAllByText("No estimation: 1").length).toBeGreaterThan(0);
		expect(
			screen.getByRole("progressbar", {
				name: "Current Sprint Story Point progress",
			}),
		).toBeTruthy();
		expect(screen.queryByText(/%/)).toBeNull();
	});

	it("omits Current Sprint progress bar when no Done Column is configured", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board", ownerIds: ["owner-1"] }),
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "To Do", position: 0 }),
		]);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({
				id: "estimated-task",
				title: "Estimated",
				columnId: "column-todo",
				storyPoints: 8,
			}),
		]);
		queryClient.setQueryData(
			projectDoneColumnQueryOptions("project-1").queryKey,
			doneColumn({ doneColumnId: null, requiresDesignation: true }),
		);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(
			screen.getByText("Story Point progress needs a Done Column."),
		).toBeTruthy();
		expect(
			screen.queryByRole("progressbar", {
				name: "Current Sprint Story Point progress",
			}),
		).toBeNull();
	});

	it("omits Current Sprint progress bar when sprint tasks have zero estimated points", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board" }),
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "To Do", position: 0 }),
			column({ id: "column-done", name: "Done", position: 1 }),
		]);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({ id: "first", title: "First", storyPoints: null }),
			task({ id: "second", title: "Second", storyPoints: null }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(screen.getByText("0 pts estimated")).toBeTruthy();
		expect(screen.getByText("No estimation: 2")).toBeTruthy();
		expect(
			screen.queryByRole("progressbar", {
				name: "Current Sprint Story Point progress",
			}),
		).toBeNull();
	});

	it("recalculates Current Sprint progress after Story Point and Done Column changes", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board" }),
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "To Do", position: 0 }),
			column({ id: "column-done", name: "Done", position: 1 }),
		]);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({
				id: "todo-task",
				title: "Todo estimated",
				columnId: "column-todo",
				storyPoints: 3,
			}),
			task({
				id: "done-task",
				title: "Done estimated",
				columnId: "column-done",
				storyPoints: 5,
			}),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);
		expect(screen.getByText("5 pts done")).toBeTruthy();
		expect(screen.getByText("3 pts remaining")).toBeTruthy();

		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({
				id: "todo-task",
				title: "Todo estimated",
				columnId: "column-todo",
				storyPoints: 8,
			}),
			task({
				id: "done-task",
				title: "Done estimated",
				columnId: "column-done",
				storyPoints: 5,
			}),
		]);
		queryClient.setQueryData(
			projectDoneColumnQueryOptions("project-1").queryKey,
			doneColumn({ doneColumnId: "column-todo" }),
		);
		cleanup();
		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(screen.getByText("8 pts done")).toBeTruthy();
		expect(screen.getByText("5 pts remaining")).toBeTruthy();
	});

	it("shows close confirmation and closes the active sprint", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "sprint-token" }),
		);
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "owner-1",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board", ownerIds: ["owner-1"] }),
		);
		queryClient.setQueryData(
			projectActiveSprintQueryOptions("project-1").queryKey,
			activeSprint({ id: "sprint-1", goal: "Close goal" }),
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "To Do", position: 0 }),
		]);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({
				id: "unfinished-task",
				title: "Unfinished task",
				columnId: "column-todo",
				sprintId: "sprint-1",
			}),
		]);
		queryClient.setQueryData(
			projectBacklogQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(
			projectSprintHistoryQueryOptions("project-1").queryKey,
			[],
		);
		const sprintJson = {
			id: "sprint-1",
			project_id: "project-1",
			name: "Sprint 1",
			lifecycle_state: "active",
			planned_start_date: "2026-06-01",
			planned_end_date: "2026-06-14",
			goal: "Close goal",
			closed_at: null,
			created_at: null,
			updated_at: null,
		};
		const taskJson = {
			id: "unfinished-task",
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
						unfinished_count: 2,
						unfinished_tasks: [
							taskJson,
							{
								...taskJson,
								id: "unestimated-task",
								title: "Unestimated unfinished",
								story_points: null,
							},
						],
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
						unfinished_count: 2,
						unfinished_tasks: [
							{ ...taskJson, sprint_id: null, backlog_rank: "!" },
							{
								...taskJson,
								id: "unestimated-task",
								title: "Unestimated unfinished",
								story_points: null,
								sprint_id: null,
								backlog_rank: "~",
							},
						],
						carryover_statement:
							"Unfinished tasks will move to the top of the Backlog.",
						snapshots: [],
					}),
					{ headers: { "content-type": "application/json" }, status: 200 },
				),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify(null), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify([{ ...taskJson, sprint_id: null }]), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify([{ ...taskJson, sprint_id: null, backlog_rank: "!" }]),
					{ headers: { "content-type": "application/json" }, status: 200 },
				),
			);
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);
		fireEvent.click(screen.getByRole("button", { name: "Close sprint" }));

		await waitFor(() => expect(screen.getByText("Confirm close")).toBeTruthy());
		expect(screen.getAllByText("Unfinished task").length).toBeGreaterThan(0);
		expect(screen.getByText("8 pts")).toBeTruthy();
		expect(screen.getByText("Unestimated unfinished")).toBeTruthy();
		expect(screen.getAllByText("No estimation").length).toBeGreaterThan(0);
		expect(screen.getByText("Unfinished")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Confirm close" }));

		await waitFor(() =>
			expect(
				fetchSpy.mock.calls.some(
					([url]) =>
						url ===
						"https://api.example.test/projects/project-1/sprints/active/close",
				),
			).toBe(true),
		);
		expect(
			fetchSpy.mock.calls.some(
				([url]) =>
					url ===
					"https://api.example.test/projects/project-1/sprints/active/close-confirmation",
			),
		).toBe(true);
		expect(
			fetchSpy.mock.calls.some(
				([url]) =>
					url ===
					"https://api.example.test/projects/project-1/sprints/active/close",
			),
		).toBe(true);
	});

	it("renders active sprint metadata read-only for non-owner members", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "member-1",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({
				name: "API Board",
				ownerIds: ["owner-1"],
				memberIds: ["member-1"],
			}),
		);
		queryClient.setQueryData(
			projectActiveSprintQueryOptions("project-1").queryKey,
			activeSprint({ goal: "Member visible goal" }),
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(screen.getAllByText("Sprint 1").length).toBeGreaterThan(0);
		expect(screen.getByText("Member visible goal")).toBeTruthy();
		expect(screen.queryByRole("button", { name: /edit sprint/i })).toBeNull();
	});

	it("lets project owners save the Done Column from Edit Project", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "done-column-token" }),
		);
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "owner-1",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board", ownerIds: ["owner-1"] }),
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "To Do", position: 0 }),
			column({ id: "column-done", name: "Done", position: 1 }),
		]);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(
			projectDoneColumnQueryOptions("project-1").queryKey,
			doneColumn({ doneColumnId: "column-done" }),
		);
		queryClient.setQueryData(
			projectSprintHistoryQueryOptions("project-1").queryKey,
			[],
		);
		const fetchSpy = vi.fn<typeof fetch>().mockImplementation(async (input) => {
			const url = String(input);
			if (url.endsWith("/done-column")) {
				return new Response(
					JSON.stringify({
						project_id: "project-1",
						done_column_id: "column-todo",
						requires_designation: false,
					}),
					{ headers: { "content-type": "application/json" }, status: 200 },
				);
			}
			if (url.endsWith("/columns")) {
				return new Response(
					JSON.stringify([
						{
							id: "column-todo",
							project_id: "project-1",
							name: "To Do",
							description: null,
							position: 0,
							created_at: null,
							updated_at: null,
						},
						{
							id: "column-done",
							project_id: "project-1",
							name: "Done",
							description: null,
							position: 1,
							created_at: null,
							updated_at: null,
						},
					]),
					{ headers: { "content-type": "application/json" }, status: 200 },
				);
			}
			if (url.endsWith("/projects")) {
				return new Response(JSON.stringify([]), {
					headers: { "content-type": "application/json" },
					status: 200,
				});
			}
			return new Response(
				JSON.stringify({
					id: "project-1",
					name: "API Board",
					code: "PRJ",
					description: null,
					status: "active",
					owner_ids: ["owner-1"],
					member_ids: [],
					created_at: null,
					updated_at: null,
				}),
				{ headers: { "content-type": "application/json" }, status: 200 },
			);
		});
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(
			screen.queryByRole("button", { name: /save done column/i }),
		).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: /edit project/i }));
		fireEvent.change(screen.getByLabelText("Done Column"), {
			target: { value: "column-todo" },
		});
		fireEvent.click(screen.getByRole("button", { name: /save project/i }));

		await waitFor(() =>
			expect(
				fetchSpy.mock.calls.some(
					([url, init]) =>
						url === "https://api.example.test/projects/project-1" &&
						init?.method === "PATCH",
				),
			).toBe(true),
		);
		const doneColumnRequest = fetchSpy.mock.calls.find(
			([url, init]) =>
				url === "https://api.example.test/projects/project-1/done-column" &&
				init?.method === "PATCH",
		);
		expect(doneColumnRequest?.[0]).toBe(
			"https://api.example.test/projects/project-1/done-column",
		);
		expect(JSON.parse(String(doneColumnRequest?.[1]?.body))).toEqual({
			done_column_id: "column-todo",
		});
		expect(
			fetchSpy.mock.calls.some(([url]) =>
				String(url).includes("/sprints/history"),
			),
		).toBe(false);
		await waitFor(() =>
			expect(
				queryClient.getQueryData(
					projectDoneColumnQueryOptions("project-1").queryKey,
				),
			).toMatchObject({ doneColumnId: "column-todo" }),
		);
	});

	it("prompts owners to designate a missing Done Column in Edit Project", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "owner-1",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board", ownerIds: ["owner-1"] }),
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "To Do", position: 0 }),
		]);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(
			projectDoneColumnQueryOptions("project-1").queryKey,
			doneColumn({ doneColumnId: null, requiresDesignation: true }),
		);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(screen.getByText("Designation required")).toBeTruthy();
		expect(
			screen.getByText(/Choose a Done Column in Edit Project/i),
		).toBeTruthy();
		expect(screen.queryByLabelText("Done Column")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: /open edit project/i }));
		expect(screen.getByLabelText("Done Column")).toHaveProperty("value", "");
		expect(
			screen.getByRole("button", { name: /save project/i }),
		).not.toHaveProperty("disabled", true);
	});

	it("requires a Done Column when saving Edit Project with workflow columns", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "owner-1",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board", ownerIds: ["owner-1"] }),
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "To Do", position: 0 }),
		]);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(
			projectDoneColumnQueryOptions("project-1").queryKey,
			doneColumn({ doneColumnId: null, requiresDesignation: true }),
		);
		const fetchSpy = vi.fn<typeof fetch>();
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);
		fireEvent.click(screen.getByRole("button", { name: /open edit project/i }));
		fireEvent.click(screen.getByRole("button", { name: /save project/i }));

		expect(fetchSpy).not.toHaveBeenCalled();
		expect(
			screen.getByText("Done Column is required when workflow columns exist."),
		).toBeTruthy();
	});

	it("allows metadata save with Done Column disabled when no workflow columns exist", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "project-token" }),
		);
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		seedProjectBoardQueries(queryClient);
		queryClient.setQueryData(
			projectColumnsQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(
			projectDoneColumnQueryOptions("project-1").queryKey,
			doneColumn({ doneColumnId: null, requiresDesignation: false }),
		);
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: "project-1",
					name: "No Columns Board",
					code: "PRJ",
					description: null,
					status: "active",
					owner_ids: ["owner-1"],
					member_ids: [],
					created_at: null,
					updated_at: null,
				}),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);
		fireEvent.click(screen.getByRole("button", { name: /edit project/i }));
		fireEvent.change(screen.getByLabelText("Project title"), {
			target: { value: "No Columns Board" },
		});
		expect(screen.getByLabelText("Done Column")).toHaveProperty(
			"disabled",
			true,
		);
		expect(
			screen.getByText(/Add a workflow column before choosing a Done Column/i),
		).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: /save project/i }));

		await waitFor(() =>
			expect(
				fetchSpy.mock.calls.some(
					([url, init]) =>
						url === "https://api.example.test/projects/project-1" &&
						init?.method === "PATCH",
				),
			).toBe(true),
		);
		expect(
			fetchSpy.mock.calls.some(
				([url, init]) =>
					url === "https://api.example.test/projects/project-1/done-column" &&
					init?.method === "PATCH",
			),
		).toBe(false);
		expect(
			fetchSpy.mock.calls.some(
				([url, init]) =>
					url === "https://api.example.test/projects/project-1" &&
					init?.method === "PATCH",
			),
		).toBe(true);
	});

	it("renders the shareable Backlog list view without workflow board cards", async () => {
		const { ProjectBoardContent } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "member-1",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({
				name: "API Board",
				ownerIds: ["owner-1"],
				memberIds: ["member-1"],
			}),
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "To Do", position: 0 }),
		]);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({ id: "sprint-task", title: "Sprint task", sprintId: "sprint-1" }),
		]);
		queryClient.setQueryData(projectBacklogQueryOptions("project-1").queryKey, [
			task({
				id: "backlog-first",
				title: "Backlog first",
				sprintId: null,
				backlogRank: "F",
				storyPoints: 5,
			}),
			task({
				id: "backlog-second",
				title: "Backlog second",
				sprintId: null,
				backlogRank: "U",
			}),
		]);

		renderWithQueryClient(
			<ProjectBoardContent projectId="project-1" view="backlog" />,
			queryClient,
		);

		expect(screen.getByText("Planning list")).toBeTruthy();
		expect(screen.getByText("Backlog first")).toBeTruthy();
		expect(screen.getByText("Backlog second")).toBeTruthy();
		expect(screen.getByText("5 pts estimated")).toBeTruthy();
		expect(screen.getAllByText("No estimation: 1").length).toBeGreaterThan(0);
		expect(screen.getByText("5 pts")).toBeTruthy();
		expect(screen.getByText("No estimation")).toBeTruthy();
		expect(screen.queryByText("Sprint task")).toBeNull();
		expect(screen.queryByText("No tasks in to do.")).toBeNull();
		expect(screen.getByRole("link", { name: "Current Sprint" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Current Sprint" })).toHaveProperty(
			"href",
			expect.stringContaining("/projects/project-1"),
		);
		expect(screen.queryByLabelText("Backlog task title")).toBeNull();
		expect(
			screen.getByRole("link", { name: "Add Backlog Task" }),
		).toHaveProperty(
			"href",
			expect.stringContaining("/projects/project-1/tasks/new?backlog=true"),
		);
		expect(screen.getByRole("link", { name: "Backlog first" })).toHaveProperty(
			"href",
			expect.stringContaining(
				"/projects/project-1/tasks/backlog-first?backlog=true",
			),
		);
	});

	it("renders shareable Sprint History with grouped snapshots and live task links", async () => {
		projectSearch = { view: "history" };
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "member-1",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({
				name: "API Board",
				ownerIds: ["owner-1"],
				memberIds: ["member-1"],
			}),
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "To Do", position: 0 }),
		]);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({ id: "sprint-task", title: "Sprint task", sprintId: "sprint-1" }),
		]);
		queryClient.setQueryData(
			projectBacklogQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(
			projectSprintHistoryQueryOptions("project-1").queryKey,
			[
				{
					sprint: activeSprint({
						id: "closed-sprint",
						lifecycleState: "closed",
						closedAt: new Date("2026-06-09T20:00:00Z"),
						goal: "History goal",
					}),
					finishedCount: 1,
					unfinishedCount: 2,
					unfinishedTasks: [],
					carryoverStatement:
						"Unfinished tasks will move to the top of the Backlog.",
					snapshots: [
						{
							id: "snapshot-finished",
							sprintId: "closed-sprint",
							taskId: "finished-task",
							columnId: "column-done",
							title: "Finished close-time title",
							outcome: "finished",
							priority: null,
							storyPoints: 5,
							rank: "U",
							description: "Finished notes",
							acceptanceCriteria: null,
							tag: null,
							liveTaskExists: true,
							createdAt: null,
						},
						{
							id: "snapshot-deleted",
							sprintId: "closed-sprint",
							taskId: "deleted-task",
							columnId: "column-todo",
							title: "Deleted close-time title",
							outcome: "unfinished",
							priority: null,
							storyPoints: 3,
							rank: "V",
							description: null,
							acceptanceCriteria: "Close-time criteria",
							tag: null,
							liveTaskExists: false,
							createdAt: null,
						},
						{
							id: "snapshot-unestimated",
							sprintId: "closed-sprint",
							taskId: "unestimated-task",
							columnId: "column-todo",
							title: "Unestimated close-time title",
							outcome: "unfinished",
							priority: null,
							storyPoints: null,
							rank: "W",
							description: null,
							acceptanceCriteria: null,
							tag: null,
							liveTaskExists: true,
							createdAt: null,
						},
					],
				},
			],
		);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(screen.getByText("Closed sprints")).toBeTruthy();
		expect(screen.getAllByText("Sprint 1").length).toBeGreaterThan(0);
		expect(screen.getByText("History goal")).toBeTruthy();
		expect(screen.getByText("1 finished")).toBeTruthy();
		expect(screen.getByText("2 unfinished")).toBeTruthy();
		expect(screen.getByText("Historical Story Point split")).toBeTruthy();
		expect(screen.getByText("5 pts finished")).toBeTruthy();
		expect(screen.getByText("3 pts unfinished")).toBeTruthy();
		expect(screen.getAllByText("No estimation: 1").length).toBeGreaterThan(0);
		expect(
			screen.getByRole("progressbar", {
				name: "Sprint 1 finished Story Point progress",
			}),
		).toBeTruthy();
		expect(
			screen.getByRole("progressbar", {
				name: "Sprint 1 unfinished Story Point progress",
			}),
		).toBeTruthy();
		expect(screen.getByText("Finished")).toBeTruthy();
		expect(screen.getByText("Unfinished")).toBeTruthy();
		expect(screen.getByText("5 pts")).toBeTruthy();
		expect(screen.getByText("3 pts")).toBeTruthy();
		expect(screen.getByText("No estimation")).toBeTruthy();
		expect(screen.getByText("Finished notes")).toBeTruthy();
		expect(screen.getByText("Close-time criteria")).toBeTruthy();
		expect(
			screen.getByRole("link", { name: "Finished close-time title" }),
		).toHaveProperty(
			"href",
			expect.stringContaining("/projects/project-1/tasks/finished-task"),
		);
		expect(screen.getByText("Deleted close-time title")).toBeTruthy();
		expect(screen.getByText("Live task deleted")).toBeTruthy();
		expect(screen.queryByText("Sprint task")).toBeNull();
	});

	it("persists manual Backlog reorder", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "backlog-token" }),
		);
		const { ProjectBoardContent } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "owner-1",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board", ownerIds: ["owner-1"] }),
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "To Do", position: 0 }),
		]);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(projectBacklogQueryOptions("project-1").queryKey, [
			task({ id: "first", title: "First", sprintId: null, backlogRank: "F" }),
			task({ id: "second", title: "Second", sprintId: null, backlogRank: "U" }),
		]);
		queryClient.setQueryData(
			projectSprintHistoryQueryOptions("project-1").queryKey,
			[],
		);
		const taskJson = (id: string, title: string, backlog_rank: string) => ({
			id,
			project_id: "project-1",
			sprint_id: null,
			title,
			column_id: "column-todo",
			priority: null,
			rank: "U",
			backlog_rank,
			assignee_id: null,
			description: null,
			acceptance_criteria: null,
			tag: null,
			created_at: null,
			updated_at: null,
		});
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify([
						taskJson("second", "Second", "U"),
						taskJson("first", "First", "j"),
					]),
					{ headers: { "content-type": "application/json" }, status: 200 },
				),
			);
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(
			<ProjectBoardContent projectId="project-1" view="backlog" />,
			queryClient,
		);
		fireEvent.click(screen.getByRole("button", { name: "Move Second up" }));
		await waitFor(() =>
			expect(
				fetchSpy.mock.calls.some(
					([url]) =>
						url ===
						"https://api.example.test/projects/project-1/backlog/reorder",
				),
			).toBe(true),
		);
		const [, init] = fetchSpy.mock.calls.find(
			([url]) =>
				url === "https://api.example.test/projects/project-1/backlog/reorder",
		) ?? [null, undefined];
		expect(JSON.parse(String(init?.body))).toEqual({
			task_ids: ["second", "first"],
		});
	});

	it("adds a backlog task to the active sprint from the Backlog view", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "sprint-token" }),
		);
		const { ProjectBoardContent } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "member-1",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({
				name: "API Board",
				ownerIds: ["owner-1"],
				memberIds: ["member-1"],
			}),
		);
		queryClient.setQueryData(
			projectActiveSprintQueryOptions("project-1").queryKey,
			activeSprint({ id: "sprint-1" }),
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-review", name: "Review", position: 1 }),
		]);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(projectBacklogQueryOptions("project-1").queryKey, [
			task({
				id: "backlog-task",
				title: "Ready backlog task",
				columnId: "column-review",
				sprintId: null,
				backlogRank: "F",
				storyPoints: null,
			}),
		]);
		queryClient.setQueryData(
			projectSprintHistoryQueryOptions("project-1").queryKey,
			[],
		);
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: "backlog-task",
					project_id: "project-1",
					sprint_id: "sprint-1",
					title: "Ready backlog task",
					column_id: "column-review",
					priority: null,
					story_points: null,
					rank: "U",
					backlog_rank: null,
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

		renderWithQueryClient(
			<ProjectBoardContent projectId="project-1" view="backlog" />,
			queryClient,
		);
		expect(screen.getByText("No estimation")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: /add to sprint/i }));

		await waitFor(() =>
			expect(
				fetchSpy.mock.calls.some(
					([url]) =>
						url ===
						"https://api.example.test/projects/project-1/sprints/active/tasks",
				),
			).toBe(true),
		);
		const [, init] = fetchSpy.mock.calls.find(
			([url]) =>
				url ===
				"https://api.example.test/projects/project-1/sprints/active/tasks",
		) ?? [null, undefined];
		expect(JSON.parse(String(init?.body))).toEqual({
			task_id: "backlog-task",
		});
	});

	it("removes an active sprint task back to Backlog from the board", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "sprint-token" }),
		);
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "member-1",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({
				name: "API Board",
				ownerIds: ["owner-1"],
				memberIds: ["member-1"],
			}),
		);
		queryClient.setQueryData(
			projectActiveSprintQueryOptions("project-1").queryKey,
			activeSprint({ id: "sprint-1" }),
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "To Do", position: 0 }),
		]);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({
				id: "sprint-task",
				title: "Sprint task",
				columnId: "column-todo",
				sprintId: "sprint-1",
			}),
		]);
		queryClient.setQueryData(
			projectBacklogQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(
			projectSprintHistoryQueryOptions("project-1").queryKey,
			[],
		);
		const removedTaskJson = {
			id: "sprint-task",
			project_id: "project-1",
			sprint_id: null,
			title: "Sprint task",
			column_id: "column-todo",
			priority: null,
			rank: "U",
			backlog_rank: "F",
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
				new Response(JSON.stringify(removedTaskJson), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify([removedTaskJson]), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify([removedTaskJson]), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			);
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);
		fireEvent.click(screen.getByRole("button", { name: "Backlog" }));

		await waitFor(() =>
			expect(
				fetchSpy.mock.calls.some(
					([url]) =>
						url ===
						"https://api.example.test/projects/project-1/sprints/active/tasks/sprint-task",
				),
			).toBe(true),
		);
		const [, init] = fetchSpy.mock.calls.find(
			([url]) =>
				url ===
				"https://api.example.test/projects/project-1/sprints/active/tasks/sprint-task",
		) ?? [null, undefined];
		expect(init?.method).toBe("DELETE");
	});

	it("renders selected task priorities as distinct colored board tags", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board" }),
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({ id: "low-task", title: "Low task", priority: "low" }),
			task({ id: "medium-task", title: "Medium task", priority: "medium" }),
			task({ id: "high-task", title: "High task", priority: "high" }),
			task({
				id: "critical-task",
				title: "Critical task",
				priority: "critical",
			}),
		]);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(screen.getByText("Low").className).toContain(
			"bg-[var(--surface-container-high)]",
		);
		expect(screen.getByText("Medium").className).toContain(
			"bg-[var(--primary-fixed)]",
		);
		expect(screen.getByText("High").className).toContain(
			"var(--tertiary-container)",
		);
		expect(screen.getByText("Critical").className).toContain(
			"var(--error,#ba1a1a)",
		);
	});

	it("omits the priority tag for tasks with no priority", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board" }),
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({
				id: "unprioritized-task",
				title: "Unprioritized",
				priority: null,
			}),
		]);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(screen.getByText("Unprioritized")).toBeTruthy();
		expect(screen.queryByText("Low")).toBeNull();
		expect(screen.queryByText("Medium")).toBeNull();
		expect(screen.queryByText("High")).toBeNull();
		expect(screen.queryByText("Critical")).toBeNull();
	});

	it("shows priority before custom task tags when both exist", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board" }),
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({
				id: "tagged-task",
				title: "Tagged task",
				priority: "high",
				tag: "Backend",
			}),
		]);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		const priorityTag = screen.getByText("High");
		const customTag = screen.getByText("Backend");
		expect(priorityTag.compareDocumentPosition(customTag)).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING,
		);
	});

	it("displays legacy urgent task priority as critical", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board" }),
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({ id: "urgent-task", title: "Legacy task", priority: "urgent" }),
		]);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(screen.getByText("Critical")).toBeTruthy();
		expect(screen.queryByText("Urgent")).toBeNull();
	});

	it("shows the project description below the board title", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({
				name: "API Board",
				description: "Coordinate the API launch work for the platform team.",
			}),
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(screen.getByText("Main Board: API Board")).toBeTruthy();
		expect(
			screen.getByText("Coordinate the API launch work for the platform team."),
		).toBeTruthy();
	});

	it("shows an intentional fallback when the project description is absent or blank", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board", description: null }),
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);
		expect(screen.getByText("No project description yet.")).toBeTruthy();

		cleanup();
		const blankQueryClient = createTestQueryClient();
		blankQueryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board", description: "   " }),
		);
		blankQueryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		blankQueryClient.setQueryData(
			projectColumnsQueryOptions("project-1").queryKey,
			[column({ id: "column-todo", name: "Backlog", position: 0 })],
		);

		renderWithQueryClient(<ProjectBoardPage />, blankQueryClient);
		expect(screen.getByText("No project description yet.")).toBeTruthy();
	});

	it("shows project metadata read-only for non-owner project members", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "member-1",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({
				name: "API Board",
				description: "Shared context for non-owner project members.",
				ownerIds: ["owner-1"],
				memberIds: ["member-1"],
			}),
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(screen.getByText("Main Board: API Board")).toBeTruthy();
		expect(
			screen.getByText("Shared context for non-owner project members."),
		).toBeTruthy();
		expect(screen.queryByRole("button", { name: /edit project/i })).toBeNull();
	});

	it("shows owner-only inline project metadata editing controls", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		seedProjectBoardQueries(queryClient);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		fireEvent.click(screen.getByRole("button", { name: /edit project/i }));

		expect(screen.getByRole("form", { name: /edit project/i })).toBeTruthy();
		expect(screen.getByLabelText("Project title")).toHaveProperty(
			"value",
			"API Board",
		);
		expect(screen.getByLabelText("Project description")).toHaveProperty(
			"value",
			"",
		);
		expect(screen.getByLabelText("Project code")).toHaveProperty(
			"value",
			"PRJ",
		);
		expect(screen.getByLabelText("Project status")).toHaveProperty(
			"value",
			"active",
		);
	});

	it("saves trimmed project metadata and updates cached board details", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "project-token" }),
		);
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		seedProjectBoardQueries(queryClient);
		const fetchSpy = vi.fn<typeof fetch>().mockImplementation(
			async () =>
				new Response(
					JSON.stringify({
						id: "project-1",
						name: "Renamed Board",
						code: "PRJ",
						description: "Updated context",
						status: "paused",
						owner_ids: ["owner-1"],
						member_ids: [],
						created_at: null,
						updated_at: null,
					}),
					{ headers: { "content-type": "application/json" }, status: 200 },
				),
		);
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);
		fireEvent.click(screen.getByRole("button", { name: /edit project/i }));
		fireEvent.change(screen.getByLabelText("Project title"), {
			target: { value: "  Renamed Board  " },
		});
		fireEvent.change(screen.getByLabelText("Project description"), {
			target: { value: "Updated context" },
		});
		fireEvent.change(screen.getByLabelText("Project status"), {
			target: { value: "paused" },
		});
		fetchSpy.mockClear();
		fireEvent.click(screen.getByRole("button", { name: /save project/i }));

		await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
		const saveRequest = fetchSpy.mock.calls.find(([, init]) => init?.body);
		expect(JSON.parse(String(saveRequest?.[1]?.body))).toEqual({
			name: "Renamed Board",
			code: "PRJ",
			description: "Updated context",
			status: "paused",
		});
		await waitFor(() =>
			expect(screen.getByText("Main Board: Renamed Board")).toBeTruthy(),
		);
		expect(screen.getByText("Project details saved.")).toBeTruthy();
		expect(screen.queryByRole("form", { name: /edit project/i })).toBeNull();
		expect(
			queryClient.getQueryData(projectQueryOptions("project-1").queryKey),
		).toMatchObject({
			name: "Renamed Board",
			description: "Updated context",
			status: "paused",
		});
	});

	it("cancels inline project metadata edits without saving", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		seedProjectBoardQueries(queryClient);
		const fetchSpy = vi.fn<typeof fetch>();
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);
		fireEvent.click(screen.getByRole("button", { name: /edit project/i }));
		fireEvent.change(screen.getByLabelText("Project title"), {
			target: { value: "Unsaved Board" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

		expect(fetchSpy).not.toHaveBeenCalled();
		expect(screen.getByText("Main Board: API Board")).toBeTruthy();
		expect(screen.queryByRole("form", { name: /edit project/i })).toBeNull();
	});

	it("persists explicit null when an owner clears the project description", async () => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "project-token" }),
		);
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		seedProjectBoardQueries(queryClient);
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({
				name: "API Board",
				description: "Existing context",
				ownerIds: ["owner-1"],
			}),
		);
		const fetchSpy = vi.fn<typeof fetch>().mockImplementation(
			async () =>
				new Response(
					JSON.stringify({
						id: "project-1",
						name: "API Board",
						code: "PRJ",
						description: null,
						status: "active",
						owner_ids: ["owner-1"],
						member_ids: [],
						created_at: null,
						updated_at: null,
					}),
					{ headers: { "content-type": "application/json" }, status: 200 },
				),
		);
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);
		fireEvent.click(screen.getByRole("button", { name: /edit project/i }));
		fireEvent.change(screen.getByLabelText("Project description"), {
			target: { value: "" },
		});
		fetchSpy.mockClear();
		fireEvent.click(screen.getByRole("button", { name: /save project/i }));

		await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
		const saveRequest = fetchSpy.mock.calls.find(([, init]) => init?.body);
		expect(JSON.parse(String(saveRequest?.[1]?.body))).toEqual({
			name: "API Board",
			code: "PRJ",
			description: null,
			status: "active",
		});
		await waitFor(() =>
			expect(screen.getByText("No project description yet.")).toBeTruthy(),
		);
	});

	it("removes board card updated-at pills", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board" }),
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({ id: "todo-task", title: "API Todo", columnId: "column-todo" }),
		]);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(screen.getByText("API Todo")).toBeTruthy();
		expect(screen.queryByText("No activity date")).toBeNull();
	});

	it("shows an owner-aware Invite action instead of Share", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "owner-1",
			first_name: "Jane",
			last_name: "Doe",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board", ownerIds: ["owner-1"] }),
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		const inviteButton = screen.getByRole("button", { name: "Invite" });
		expect((inviteButton as HTMLButtonElement).disabled).toBe(false);
		expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
		expect(screen.queryByText("Invites unavailable")).toBeNull();
	});

	it("disables Invite for non-owners", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "member-1",
			first_name: "Jane",
			last_name: "Doe",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({
				name: "API Board",
				memberIds: ["member-1"],
				ownerIds: ["owner-1"],
			}),
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(
			(screen.getByRole("button", { name: "Invite" }) as HTMLButtonElement)
				.disabled,
		).toBe(true);
	});

	it("opens an invite modal with existing owners and members", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "owner-1",
			first_name: "Jane",
			last_name: "Doe",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({
				name: "API Board",
				memberIds: ["member-1"],
				ownerIds: ["owner-1"],
			}),
		);
		queryClient.setQueryData(
			projectAccessUsersQueryKey("project-1", ["owner-1", "member-1"]),
			[
				userProfile({
					display_name: "Jane Owner",
					external_id: "owner@example.test",
					id: "owner-1",
				}),
				userProfile({
					display_name: "Maya Member",
					external_id: "member@example.test",
					id: "member-1",
				}),
			],
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);
		fireEvent.click(screen.getByRole("button", { name: "Invite" }));

		expect(screen.getByRole("dialog", { name: "Invite members" })).toBeTruthy();
		await waitFor(() => expect(screen.getByText("Jane Owner")).toBeTruthy());
		expect(screen.getByText("Maya Member")).toBeTruthy();
		expect(screen.getByText("owner@example.test")).toBeTruthy();
		expect(screen.getByText("member@example.test")).toBeTruthy();
		expect(screen.getByText("Owner")).toBeTruthy();
	});

	it("adds selected members while retaining failed users for retry", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "invite-token" }),
		);
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify([
						{
							display_name: "Ada Candidate",
							external_id: "ada@example.test",
							first_name: null,
							id: "candidate-1",
							last_name: null,
						},
					]),
					{ headers: { "content-type": "application/json" }, status: 200 },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify([
						{
							display_name: "Linus Candidate",
							external_id: "linus@example.test",
							first_name: null,
							id: "candidate-2",
							last_name: null,
						},
					]),
					{ headers: { "content-type": "application/json" }, status: 200 },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						id: "project-1",
						name: "API Board",
						code: "PRJ",
						description: null,
						status: "active",
						owner_ids: ["owner-1"],
						member_ids: ["candidate-1"],
						created_at: null,
						updated_at: null,
					}),
					{ headers: { "content-type": "application/json" }, status: 200 },
				),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ detail: "Unable to add member" }), {
					headers: { "content-type": "application/json" },
					status: 500,
				}),
			);
		vi.stubGlobal("fetch", fetchSpy);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "owner-1",
			first_name: "Jane",
			last_name: "Doe",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board", ownerIds: ["owner-1"] }),
		);
		queryClient.setQueryData(
			projectAccessUsersQueryKey("project-1", ["owner-1"]),
			[
				userProfile({
					display_name: "Jane Owner",
					external_id: "owner@example.test",
					id: "owner-1",
				}),
			],
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);
		fireEvent.click(screen.getByRole("button", { name: "Invite" }));
		fireEvent.change(screen.getByLabelText("Search Kanai users"), {
			target: { value: "Ad" },
		});

		await waitFor(() => expect(screen.getByText("Ada Candidate")).toBeTruthy());
		fireEvent.click(screen.getByRole("checkbox", { name: /Ada Candidate/i }));
		expect(screen.getByText("1 selected")).toBeTruthy();

		fireEvent.change(screen.getByLabelText("Search Kanai users"), {
			target: { value: "Li" },
		});

		await waitFor(() =>
			expect(screen.getByText("Linus Candidate")).toBeTruthy(),
		);
		expect(screen.getByText("1 selected")).toBeTruthy();
		fireEvent.click(screen.getByRole("checkbox", { name: /Linus Candidate/i }));
		expect(screen.getByText("2 selected")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Add selected (2)" }));

		await waitFor(() =>
			expect(screen.getByText("Added 1 member.")).toBeTruthy(),
		);
		expect(screen.getByText("Could not add Linus Candidate.")).toBeTruthy();
		expect(screen.getByText("1 selected")).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Add selected (1)" }),
		).toBeTruthy();
		expect(screen.getByText("Ada Candidate")).toBeTruthy();
		expect(fetchSpy.mock.calls.map(([url]) => String(url)).slice(0, 4)).toEqual(
			[
				"https://api.example.test/users?limit=20&q=Ad",
				"https://api.example.test/users?limit=20&q=Li",
				"https://api.example.test/projects/project-1/members",
				"https://api.example.test/projects/project-1/members",
			],
		);
		expect(JSON.parse(String(fetchSpy.mock.calls[2][1]?.body))).toEqual({
			user_id: "candidate-1",
		});
		expect(JSON.parse(String(fetchSpy.mock.calls[3][1]?.body))).toEqual({
			user_id: "candidate-2",
		});
	});

	it("shows an owners-first member avatar stack that opens the member modal", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		const accessUsers = [
			userProfile({
				display_name: "Zoe Owner",
				external_id: "zoe@example.test",
				id: "owner-1",
			}),
			userProfile({
				display_name: undefined,
				external_id: "alpha.owner@example.test",
				first_name: "Ignored",
				id: "owner-2",
			}),
			userProfile({
				display_name: "Maya Member",
				external_id: "maya@example.test",
				id: "member-1",
			}),
			userProfile({
				display_name: undefined,
				external_id: "bravo@example.test",
				id: "member-2",
			}),
			userProfile({
				display_name: "Noah Guest",
				external_id: "noah@example.test",
				id: "member-3",
			}),
			userProfile({
				display_name: "Cora Hidden",
				external_id: "cora@example.test",
				id: "member-4",
			}),
		];
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "owner-1",
			first_name: "Zoe",
			last_name: "Owner",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({
				name: "API Board",
				memberIds: ["member-1", "member-2", "member-3", "member-4"],
				ownerIds: ["owner-1", "owner-2"],
			}),
		);
		queryClient.setQueryData(
			projectAccessUsersQueryKey("project-1", [
				"owner-1",
				"owner-2",
				"member-1",
				"member-2",
				"member-3",
				"member-4",
			]),
			accessUsers,
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		const memberStack = screen.getByRole("button", {
			name: "View project members",
		});
		expect(
			Array.from(memberStack.querySelectorAll("span")).map(
				(avatar) => avatar.textContent,
			),
		).toEqual(["ZO", "A", "MM", "B", "NG", "+1"]);

		fireEvent.click(memberStack);

		expect(screen.getByRole("dialog", { name: "Invite members" })).toBeTruthy();
		await waitFor(() => expect(screen.getByText("Cora Hidden")).toBeTruthy());
	});

	it("renders a dedicated move handle separate from the task detail link", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board" }),
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({
				id: "todo-task",
				title: "API Todo",
				columnId: "column-todo",
				priority: "high",
			}),
		]);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		const moveHandle = screen.getByRole("button", { name: "Move task" });
		const taskLink = screen.getByRole("link", {
			name: "Open task API Todo",
		}) as HTMLAnchorElement;

		expect(taskLink.href).toContain("/projects/project-1/tasks/todo-task");
		expect(moveHandle.closest("a")).toBeNull();
		expect(taskLink.contains(moveHandle)).toBe(false);
	});

	it("opens project chat and renders recent history with author and timestamps", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "chat-token" }),
		);
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify([
					{
						author: {
							deleted: false,
							display_name: "Jane Owner",
							id: "owner-1",
							initials: "JO",
						},
						body: "Earlier decision",
						created_at: "2026-01-01T09:30:00Z",
						id: "message-1",
						project_id: "project-1",
					},
					{
						author: {
							deleted: false,
							display_name: "Maya Member",
							id: "member-1",
							initials: "MM",
						},
						body: "Latest update",
						created_at: "2026-01-01T09:45:00Z",
						id: "message-2",
						project_id: "project-1",
					},
				]),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "owner-1",
			first_name: "Jane",
			last_name: "Doe",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board", ownerIds: ["owner-1"] }),
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);
		fireEvent.click(screen.getByRole("button", { name: "Chat" }));

		const chatDialog = await screen.findByRole("dialog", {
			name: "Project chat",
		});
		expect(chatDialog.className).toContain("lg:w-[30rem]");
		expect(await screen.findByText("Jane Owner")).toBeTruthy();
		expect(screen.getByText("Maya Member")).toBeTruthy();
		expect(screen.getByText("Earlier decision")).toBeTruthy();
		expect(screen.getByText("Latest update")).toBeTruthy();
		expect(screen.getByText("JO")).toBeTruthy();
		expect(screen.getByText("MM")).toBeTruthy();
		expect(chatDialog.querySelectorAll("time")).toHaveLength(2);
		expect(fetchSpy).toHaveBeenCalledWith(
			"https://api.example.test/projects/project-1/chat/messages",
			expect.objectContaining({
				headers: expect.any(Headers),
			}),
		);
	});

	it("renders deleted project chat authors with the persisted label", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "chat-token" }),
		);
		vi.stubGlobal(
			"fetch",
			vi.fn<typeof fetch>().mockResolvedValue(
				new Response(
					JSON.stringify([
						{
							author: {
								deleted: true,
								display_name: "former-teammate",
								id: "deleted-user-1",
								initials: "F",
							},
							body: "Historical decision",
							created_at: "2026-01-01T09:30:00Z",
							id: "message-1",
							project_id: "project-1",
						},
					]),
					{ headers: { "content-type": "application/json" }, status: 200 },
				),
			),
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "owner-1",
			first_name: "Jane",
			last_name: "Doe",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board", ownerIds: ["owner-1"] }),
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);
		fireEvent.click(screen.getByRole("button", { name: "Chat" }));

		expect(await screen.findByText(/former-teammate/)).toBeTruthy();
		expect(screen.getByText(/\(deleted\)/)).toBeTruthy();
		expect(screen.getByText("Historical decision")).toBeTruthy();
	});

	it("sends project chat with Enter and preserves multiline drafts on failed sends", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "chat-token" }),
		);
		vi.stubGlobal(
			"fetch",
			vi.fn<typeof fetch>().mockResolvedValue(
				new Response(JSON.stringify([]), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			),
		);
		const queryClient = createTestQueryClient();
		seedProjectBoardQueries(queryClient);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);
		fireEvent.click(screen.getByRole("button", { name: "Chat" }));
		await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
		const socket = FakeWebSocket.instances[0];
		const messageInput = screen.getByLabelText(
			"Message",
		) as HTMLTextAreaElement;

		expect(messageInput.disabled).toBe(true);
		expect(
			(screen.getByRole("button", { name: "Send" }) as HTMLButtonElement)
				.disabled,
		).toBe(true);
		fireEvent.change(messageInput, { target: { value: "Disconnected" } });
		expect(socket.sentMessages).toEqual([]);

		fireEvent.change(messageInput, { target: { value: "Line one" } });
		socket.emitMessage({ type: "ready", project_id: "project-1" });
		await waitFor(() => expect(messageInput.disabled).toBe(false));

		fireEvent.keyDown(messageInput, { key: "Enter", shiftKey: true });
		expect(socket.sentMessages).toEqual([]);
		fireEvent.change(messageInput, {
			target: { value: "  Line one\nLine two  " },
		});
		fireEvent.keyDown(messageInput, { key: "Enter" });

		const sentEvent = JSON.parse(socket.sentMessages[0] ?? "{}");
		expect(sentEvent).toEqual({
			type: "create-message",
			body: "Line one\nLine two",
			client_message_id: expect.any(String),
		});
		expect(messageInput.value).toBe("  Line one\nLine two  ");

		act(() => {
			socket.emitMessage({
				type: "error",
				error: {
					code: "message_rejected",
					message: "Message body cannot be blank",
				},
			});
		});
		expect(screen.getByText("Message body cannot be blank")).toBeTruthy();
		expect(messageInput.value).toBe("  Line one\nLine two  ");

		act(() => {
			socket.emitMessage({
				type: "created-message",
				message: chatMessageJson(3),
				client_message_id: sentEvent.client_message_id,
			});
		});
		await waitFor(() => expect(messageInput.value).toBe(""));
	});

	it("refetches fresh project chat history each time chat opens", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "chat-token" }),
		);
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValue(
				new Response(
					JSON.stringify([
						{
							author: {
								deleted: false,
								display_name: "Jane Owner",
								id: "owner-1",
								initials: "JO",
							},
							body: "First open",
							created_at: "2026-01-01T09:30:00Z",
							id: "message-1",
							project_id: "project-1",
						},
					]),
					{ headers: { "content-type": "application/json" }, status: 200 },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify([
						{
							author: {
								deleted: false,
								display_name: "Jane Owner",
								id: "owner-1",
								initials: "JO",
							},
							body: "Second open",
							created_at: "2026-01-01T09:35:00Z",
							id: "message-2",
							project_id: "project-1",
						},
					]),
					{ headers: { "content-type": "application/json" }, status: 200 },
				),
			);
		vi.stubGlobal("fetch", fetchSpy);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "owner-1",
			first_name: "Jane",
			last_name: "Doe",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board", ownerIds: ["owner-1"] }),
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);
		fireEvent.click(screen.getByRole("button", { name: "Chat" }));
		await waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThan(0));
		fireEvent.click(screen.getByRole("button", { name: "Close chat" }));
		expect(screen.queryByRole("dialog", { name: "Project chat" })).toBeNull();
		const callsAfterFirstOpen = fetchSpy.mock.calls.length;
		fireEvent.click(screen.getByRole("button", { name: "Chat" }));

		await waitFor(() =>
			expect(fetchSpy.mock.calls.length).toBeGreaterThan(callsAfterFirstOpen),
		);
	});

	it("shows reconnecting chat state after a socket disconnect", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "chat-token" }),
		);
		vi.stubGlobal(
			"fetch",
			vi.fn<typeof fetch>().mockResolvedValue(
				new Response(JSON.stringify([]), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			),
		);
		const queryClient = createTestQueryClient();
		seedProjectBoardQueries(queryClient);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);
		fireEvent.click(screen.getByRole("button", { name: "Chat" }));

		await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
		act(() => {
			FakeWebSocket.instances[0].emitMessage({
				type: "ready",
				project_id: "project-1",
			});
		});
		await waitFor(() =>
			expect(
				screen.getByText("0/4000. Enter to send, Shift+Enter for a new line."),
			).toBeTruthy(),
		);

		act(() => {
			FakeWebSocket.instances[0].emitClose();
		});

		expect(screen.getByText("Reconnecting to chat...")).toBeTruthy();
		expect(
			screen.getByText("Sending is disabled while disconnected."),
		).toBeTruthy();
		expect(
			(screen.getByLabelText("Message") as HTMLTextAreaElement).disabled,
		).toBe(true);
	});

	it("auto-scrolls live project chat messages only near the bottom", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "chat-token" }),
		);
		vi.stubGlobal(
			"fetch",
			vi.fn<typeof fetch>().mockResolvedValue(
				new Response(JSON.stringify([chatMessageJson(1)]), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			),
		);
		const queryClient = createTestQueryClient();
		seedProjectBoardQueries(queryClient);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);
		fireEvent.click(screen.getByRole("button", { name: "Chat" }));
		await screen.findByText("Message 1");
		await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
		const messagesContainer = screen.getByTestId("project-chat-messages");
		setChatScrollMetrics(messagesContainer, {
			clientHeight: 400,
			scrollHeight: 1000,
			scrollTop: 580,
		});
		fireEvent.scroll(messagesContainer);

		act(() => {
			FakeWebSocket.instances[0].emitMessage({
				type: "created-message",
				message: chatMessageJson(2),
			});
		});

		await screen.findByText("Message 2");
		expect(messagesContainer.scrollTop).toBe(1000);
		expect(screen.queryByRole("button", { name: "New messages" })).toBeNull();

		setChatScrollMetrics(messagesContainer, {
			clientHeight: 400,
			scrollHeight: 1200,
			scrollTop: 100,
		});
		fireEvent.scroll(messagesContainer);

		act(() => {
			FakeWebSocket.instances[0].emitMessage({
				type: "created-message",
				message: chatMessageJson(3),
			});
		});

		await screen.findByText("Message 3");
		expect(messagesContainer.scrollTop).toBe(100);
		const newMessagesButton = screen.getByRole("button", {
			name: "New messages",
		});
		fireEvent.click(newMessagesButton);
		expect(messagesContainer.scrollTop).toBe(1200);
		expect(screen.queryByRole("button", { name: "New messages" })).toBeNull();
	});

	it("preserves project chat reader position when older pages load", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "chat-token" }),
		);
		let resolveOlderMessages: (response: Response) => void = () => {};
		const olderMessagesResponse = new Promise<Response>((resolve) => {
			resolveOlderMessages = resolve;
		});
		vi.stubGlobal(
			"fetch",
			vi
				.fn<typeof fetch>()
				.mockResolvedValueOnce(
					new Response(
						JSON.stringify(
							Array.from({ length: 50 }, (_, index) =>
								chatMessageJson(index + 50),
							),
						),
						{ headers: { "content-type": "application/json" }, status: 200 },
					),
				)
				.mockReturnValueOnce(olderMessagesResponse),
		);
		const queryClient = createTestQueryClient();
		seedProjectBoardQueries(queryClient);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);
		fireEvent.click(screen.getByRole("button", { name: "Chat" }));
		await screen.findByText("Message 50");
		const messagesContainer = screen.getByTestId("project-chat-messages");
		setChatScrollMetrics(messagesContainer, {
			clientHeight: 400,
			scrollHeight: 1000,
			scrollTop: 24,
		});
		fireEvent.scroll(messagesContainer);
		setChatScrollMetrics(messagesContainer, {
			clientHeight: 400,
			scrollHeight: 1260,
			scrollTop: 24,
		});

		await act(async () => {
			resolveOlderMessages(
				new Response(
					JSON.stringify([chatMessageJson(48), chatMessageJson(49)]),
					{
						headers: { "content-type": "application/json" },
						status: 200,
					},
				),
			);
			await olderMessagesResponse;
		});

		await screen.findByText("Message 48");
		expect(messagesContainer.scrollTop).toBe(284);
	});

	it("removes the board calendar view toggle", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board" }),
		);
		queryClient.setQueryData(
			projectChatMessagesQueryOptions("project-1").queryKey,
			{ messages: [], nextCursor: null },
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(screen.queryByRole("button", { name: "Calendar" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Board" })).toBeNull();
		expect(screen.getByRole("button", { name: "Chat" })).toBeTruthy();
	});

	it("surfaces tasks that reference missing project columns", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board" }),
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({ id: "todo-task", title: "API Todo", columnId: "column-todo" }),
			task({
				id: "stale-task",
				title: "Stale Workflow Task",
				columnId: "missing-column",
			}),
		]);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(screen.getByText("Stale Workflow Task")).toBeTruthy();
		expect(
			screen.getByText("Workflow column missing: missing-column"),
		).toBeTruthy();
		expect(
			screen.getByText(
				"This task references a project column that no longer exists.",
			),
		).toBeTruthy();
		expect(screen.getByText("Backlog")).toBeTruthy();
		expect(screen.getByText("API Todo")).toBeTruthy();
		expect(screen.getAllByRole("button", { name: "Move task" })).toHaveLength(
			1,
		);
	});

	it("links column task creation to the persisted column id", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board" }),
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-backlog", name: "Backlog", position: 0 }),
			column({ id: "column-review", name: "Review", position: 1 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		const addTaskLinks = screen.getAllByRole("link", { name: /add a task/i });
		expect((addTaskLinks[0] as HTMLAnchorElement).href).toContain(
			"/projects/project-1/tasks/new?column_id=column-backlog&in_sprint=true",
		);
		expect((addTaskLinks[1] as HTMLAnchorElement).href).toContain(
			"/projects/project-1/tasks/new?column_id=column-review&in_sprint=true",
		);
	});

	it("shows owner-only add-list navigation to the create-column route", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "owner-1",
			first_name: "Owner",
			last_name: "User",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board", ownerIds: ["owner-1"] }),
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-backlog", name: "Backlog", position: 0 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		const addListLink = screen.getByRole("link", {
			name: /add another list/i,
		}) as HTMLAnchorElement;
		expect(addListLink.href).toContain("/projects/project-1/columns/new");

		cleanup();
		const memberQueryClient = createTestQueryClient();
		memberQueryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "member-1",
			first_name: "Member",
			last_name: "User",
		});
		memberQueryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({
				name: "API Board",
				ownerIds: ["owner-1"],
				memberIds: ["member-1"],
			}),
		);
		memberQueryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		memberQueryClient.setQueryData(
			projectColumnsQueryOptions("project-1").queryKey,
			[column({ id: "column-backlog", name: "Backlog", position: 0 })],
		);

		renderWithQueryClient(<ProjectBoardPage />, memberQueryClient);
		expect(
			screen.queryByRole("link", { name: /add another list/i }),
		).toBeNull();
	});

	it("shows owner-only column edit navigation", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "owner-1",
			first_name: "Owner",
			last_name: "User",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board", ownerIds: ["owner-1"] }),
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-backlog", name: "Backlog", position: 0 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		const editLink = screen.getByRole("link", {
			name: /edit backlog column/i,
		}) as HTMLAnchorElement;
		expect(editLink.href).toContain(
			"/projects/project-1/columns/column-backlog",
		);

		cleanup();
		const memberQueryClient = createTestQueryClient();
		memberQueryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "member-1",
		});
		memberQueryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ ownerIds: ["owner-1"], memberIds: ["member-1"] }),
		);
		memberQueryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		memberQueryClient.setQueryData(
			projectColumnsQueryOptions("project-1").queryKey,
			[column({ id: "column-backlog", name: "Backlog", position: 0 })],
		);

		renderWithQueryClient(<ProjectBoardPage />, memberQueryClient);
		expect(
			screen.queryByRole("link", { name: /edit backlog column/i }),
		).toBeNull();
	});

	it("shows column reorder grips without arrow movement controls for owner multi-column boards", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "owner-1",
		});
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ ownerIds: ["owner-1"] }),
		);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({ id: "todo-task", title: "Todo task", columnId: "column-todo" }),
		]);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-todo", name: "Backlog", position: 0 }),
			column({ id: "column-review", name: "Review", position: 1 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(
			screen.getByRole("button", { name: "Reorder Backlog column" }),
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Reorder Review column" }),
		).toBeTruthy();
		expect(
			screen.queryByRole("button", { name: /move backlog column/i }),
		).toBeNull();
		expect(
			screen.queryByRole("button", { name: /move review column/i }),
		).toBeNull();
		expect(screen.getAllByRole("button", { name: "Move task" })).toHaveLength(
			1,
		);

		cleanup();
		const singleColumnClient = createTestQueryClient();
		singleColumnClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "owner-1",
		});
		singleColumnClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ ownerIds: ["owner-1"] }),
		);
		singleColumnClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		singleColumnClient.setQueryData(
			projectColumnsQueryOptions("project-1").queryKey,
			[column({ id: "column-todo", name: "Backlog", position: 0 })],
		);

		renderWithQueryClient(<ProjectBoardPage />, singleColumnClient);
		expect(
			screen.queryByRole("button", { name: "Reorder Backlog column" }),
		).toBeNull();
		expect(
			screen.queryByRole("button", { name: /move backlog column/i }),
		).toBeNull();

		cleanup();
		const memberClient = createTestQueryClient();
		memberClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "member-1",
		});
		memberClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ ownerIds: ["owner-1"], memberIds: ["member-1"] }),
		);
		memberClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		memberClient.setQueryData(
			projectColumnsQueryOptions("project-1").queryKey,
			[
				column({ id: "column-todo", name: "Backlog", position: 0 }),
				column({ id: "column-review", name: "Review", position: 1 }),
			],
		);

		renderWithQueryClient(<ProjectBoardPage />, memberClient);
		expect(
			screen.queryByRole("button", { name: "Reorder Backlog column" }),
		).toBeNull();
	});

	it("shows column descriptions on hover and focus with bounded wrapping text", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board" }),
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({
				id: "column-backlog",
				name: "Backlog",
				description: "Only add items that are ready for prioritization.",
			}),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);
		const trigger = screen.getByRole("button", {
			name: "Backlog column description",
		});

		fireEvent.mouseEnter(trigger);
		const tooltip = screen.getByRole("tooltip");
		expect(tooltip.textContent).toBe(
			"Only add items that are ready for prioritization.",
		);
		expect(tooltip.className).toContain("max-w-[18rem]");
		expect(tooltip.className).toContain("whitespace-pre-wrap");
		fireEvent.mouseLeave(trigger);
		expect(screen.queryByRole("tooltip")).toBeNull();

		fireEvent.focus(trigger);
		expect(screen.getByRole("tooltip")).toBeTruthy();
		fireEvent.blur(trigger);
		expect(screen.queryByRole("tooltip")).toBeNull();
	});

	it("toggles column descriptions on tap and omits triggers for empty descriptions", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "API Board" }),
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({
				id: "column-backlog",
				name: "Backlog",
				description: "Review these items weekly.",
			}),
			column({ id: "column-done", name: "Done", description: null }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);
		const trigger = screen.getByRole("button", {
			name: "Backlog column description",
		});

		fireEvent.click(trigger);
		expect(screen.getByRole("tooltip").textContent).toBe(
			"Review these items weekly.",
		);
		fireEvent.click(trigger);
		expect(screen.queryByRole("tooltip")).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Done column description" }),
		).toBeNull();
		expect(screen.getByText("Done")).toBeTruthy();
	});

	it("renders empty board columns without fixture task cards", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "Empty Board" }),
		);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-backlog", name: "Backlog", position: 0 }),
			column({ id: "column-review", name: "Review", position: 1 }),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(screen.getByText("No tasks in backlog.")).toBeTruthy();
		expect(screen.getByText("No tasks in review.")).toBeTruthy();
		expect(screen.getAllByText("Drop here to append")).toHaveLength(2);
		expect(screen.queryByText(/Conduct initial market research/i)).toBeNull();
	});
});
