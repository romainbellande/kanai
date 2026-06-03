// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
		expect(screen.queryByText(/Conduct initial market research/i)).toBeNull();
	});
});
