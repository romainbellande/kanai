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
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	currentUserQueryOptions,
	type Project,
	type ProjectColumn,
	projectAccessUsersQueryKey,
	projectColumnsQueryOptions,
	projectQueryOptions,
	projectTasksQueryOptions,
	type Task,
	type UserProfile,
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
		params?: { projectId?: string; taskId?: string };
		search?: Record<string, string>;
		to: string;
	}) => {
		const href = params?.projectId
			? to
					.replace("$projectId", params.projectId)
					.replace("$taskId", "taskId" in params ? String(params.taskId) : "")
			: to;
		const query = search ? `?${new URLSearchParams(search).toString()}` : "";

		return (
			<a href={`${href}${query}`} {...props}>
				{children}
			</a>
		);
	},
	useParams: () => ({ projectId: "project-1" }),
}));

function task(overrides: Partial<Task>): Task {
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

function column(overrides: Partial<ProjectColumn>): ProjectColumn {
	return {
		id: "column-todo",
		projectId: "project-1",
		name: "To Do",
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
		priority: "medium",
		description: null,
		status: null,
		ownerIds: [],
		memberIds: [],
		createdAt: null,
		updatedAt: null,
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
	return render(
		<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
	);
}

describe("ProjectBoardPage", () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
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
			task({ id: "todo-task", title: "API Todo", columnId: "column-todo" }),
			task({ id: "doing-task", title: "API Doing", columnId: "column-doing" }),
			task({ id: "done-task", title: "API Done", columnId: "column-done" }),
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
		expect(screen.getByText("Backlog")).toBeTruthy();
		expect(screen.getByText("Review")).toBeTruthy();
		expect(screen.getByText("Shipped")).toBeTruthy();
		expect(screen.queryByText("Other Project")).toBeNull();
		expect(screen.queryByText("Security Audit Phase 1")).toBeNull();
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
						priority: "medium",
						description: null,
						status: null,
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
			"/projects/project-1/tasks/new?column_id=column-backlog",
		);
		expect((addTaskLinks[1] as HTMLAnchorElement).href).toContain(
			"/projects/project-1/tasks/new?column_id=column-review",
		);
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
