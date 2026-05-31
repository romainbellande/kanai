// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	currentUserQueryOptions,
	projectQueryOptions,
	projectTasksQueryOptions,
	type Task,
} from "#/api/client";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		params,
		to,
		...props
	}: AnchorHTMLAttributes<HTMLAnchorElement> & {
		children: ReactNode;
		params?: { projectId?: string };
		to: string;
	}) => (
		<a
			href={params?.projectId ? to.replace("$projectId", params.projectId) : to}
			{...props}
		>
			{children}
		</a>
	),
	useParams: () => ({ projectId: "project-1" }),
}));

function task(overrides: Partial<Task>): Task {
	return {
		id: "task-1",
		projectId: "project-1",
		title: "Task",
		status: "todo",
		priority: "medium",
		assigneeId: null,
		description: null,
		acceptanceCriteria: null,
		tag: null,
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
				task({ id: "todo-task", title: "Todo", status: "todo" }),
				task({ id: "doing-task", title: "Doing", status: "in-progress" }),
				task({ id: "done-task", title: "Done", status: "done" }),
				task({ id: "unknown-task", title: "Unknown", status: "blocked" }),
				task({ id: "other-task", projectId: "project-2", title: "Other" }),
			],
			"project-1",
		);

		expect(
			columns.map((column) => column.cards.map((card) => card.id)),
		).toEqual([["todo-task", "unknown-task"], ["doing-task"], ["done-task"]]);
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
		queryClient.setQueryData(projectQueryOptions("project-1").queryKey, {
			id: "project-1",
			name: "API Board",
		});
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task({ id: "todo-task", title: "API Todo", status: "todo" }),
			task({ id: "doing-task", title: "API Doing", status: "in-progress" }),
			task({ id: "done-task", title: "API Done", status: "done" }),
			task({
				id: "other-task",
				projectId: "project-2",
				title: "Other Project",
			}),
		]);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(screen.getByText("Main Board: API Board")).toBeTruthy();
		expect(screen.getByText("API Todo")).toBeTruthy();
		expect(screen.getByText("API Doing")).toBeTruthy();
		expect(screen.getByText("API Done")).toBeTruthy();
		expect(screen.queryByText("Other Project")).toBeNull();
		expect(screen.queryByText("Security Audit Phase 1")).toBeNull();
	});

	it("renders empty board columns without fixture task cards", async () => {
		const { ProjectBoardPage } = await import(
			"#/domains/workspace/ui/ProjectBoardPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(projectQueryOptions("project-1").queryKey, {
			id: "project-1",
			name: "Empty Board",
		});
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);

		renderWithQueryClient(<ProjectBoardPage />, queryClient);

		expect(screen.getByText("No tasks in to do.")).toBeTruthy();
		expect(screen.getByText("No tasks in in progress.")).toBeTruthy();
		expect(screen.getByText("No tasks in done.")).toBeTruthy();
		expect(screen.queryByText(/Conduct initial market research/i)).toBeNull();
	});
});
