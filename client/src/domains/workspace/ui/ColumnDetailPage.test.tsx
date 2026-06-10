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
	type Project,
	type ProjectColumn,
	type ProjectDoneColumn,
	projectColumnsQueryOptions,
	projectDoneColumnQueryOptions,
	projectQueryOptions,
	projectTasksQueryOptions,
	type Task,
} from "#/api/client";
import { ColumnDetailPage } from "#/domains/workspace/ui/ColumnDetailPage";

const navigateMock = vi.fn();

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
	useNavigate: () => navigateMock,
	useParams: () => ({ projectId: "project-1", columnId: "column-1" }),
}));

function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
			mutations: { retry: false },
		},
	});
}

function project(overrides: Partial<Project> = {}): Project {
	return {
		id: "project-1",
		name: "Launch Plan",
		code: "LCH",
		priority: "medium",
		description: null,
		status: null,
		ownerIds: ["user-1"],
		memberIds: ["member-1"],
		createdAt: null,
		updatedAt: null,
		...overrides,
	};
}

function column(overrides: Partial<ProjectColumn> = {}): ProjectColumn {
	return {
		id: "column-1",
		projectId: "project-1",
		name: "Backlog",
		description: "Ideas to refine",
		position: 0,
		createdAt: null,
		updatedAt: null,
		...overrides,
	};
}

function task(overrides: Partial<Task> = {}): Task {
	return {
		id: "task-1",
		projectId: "project-1",
		sprintId: null,
		backlogRank: null,
		title: "Draft launch checklist",
		columnId: "column-1",
		priority: "medium",
		rank: "a0",
		assigneeId: null,
		description: null,
		acceptanceCriteria: null,
		tag: null,
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

function seedDoneColumn(
	queryClient: QueryClient,
	value: ProjectDoneColumn = doneColumn(),
) {
	queryClient.setQueryData(
		projectDoneColumnQueryOptions("project-1").queryKey,
		value,
	);
}

function renderColumnDetailPage(queryClient = createTestQueryClient()) {
	if (
		queryClient.getQueryData(
			projectDoneColumnQueryOptions("project-1").queryKey,
		) === undefined
	) {
		seedDoneColumn(queryClient);
	}

	return render(
		<QueryClientProvider client={queryClient}>
			<ColumnDetailPage />
		</QueryClientProvider>,
	);
}

describe("ColumnDetailPage", () => {
	beforeEach(() => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "column-token" }),
		);
	});

	afterEach(() => {
		cleanup();
		navigateMock.mockClear();
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		window.sessionStorage.clear();
	});

	it("renders owner edit form and cancel link", () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column(),
		]);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "user-1",
			first_name: "Column",
			last_name: "Owner",
		});

		renderColumnDetailPage(queryClient);

		expect(
			screen.getByRole("heading", { name: /edit column: backlog/i }),
		).toBeTruthy();
		expect(
			(screen.getByLabelText(/column name/i) as HTMLInputElement).value,
		).toBe("Backlog");
		expect(
			(screen.getByLabelText(/description/i) as HTMLTextAreaElement).value,
		).toBe("Ideas to refine");
		expect(
			(
				screen.getByRole("link", { name: /cancel/i }) as HTMLAnchorElement
			).getAttribute("href"),
		).toBe("/projects/project-1");
	});

	it("shows unauthorized state for non-owners", () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column(),
		]);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "member-1",
		});

		renderColumnDetailPage(queryClient);

		expect(
			screen.getByText("Only project owners can edit workflow columns."),
		).toBeTruthy();
		expect(screen.queryByRole("button", { name: /save/i })).toBeNull();
		expect(
			(
				screen.getByRole("link", {
					name: /back to board/i,
				}) as HTMLAnchorElement
			).getAttribute("href"),
		).toBe("/projects/project-1");
	});

	it("blocks deleting the current Done Column", () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-1", name: "Done" }),
			column({ id: "column-2", name: "To Do", position: 1 }),
		]);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "user-1",
		});
		seedDoneColumn(queryClient, doneColumn({ doneColumnId: "column-1" }));

		renderColumnDetailPage(queryClient);

		expect(
			screen.getByText(
				"Designate another Done Column before deleting this column.",
			),
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: /delete column/i }),
		).toHaveProperty("disabled", true);
	});

	it("shows not-found state for stale column URLs", () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column({ id: "column-2" }),
		]);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "user-1",
		});

		renderColumnDetailPage(queryClient);

		expect(
			screen.getByText("This workflow column could not be found."),
		).toBeTruthy();
		expect(
			(
				screen.getByRole("link", {
					name: /back to board/i,
				}) as HTMLAnchorElement
			).getAttribute("href"),
		).toBe("/projects/project-1");
	});

	it("navigates back to the board after successful save", async () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column(),
		]);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "user-1",
		});
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						id: "column-1",
						project_id: "project-1",
						name: "Review",
						description: "Ready for feedback",
						position: 0,
						created_at: null,
						updated_at: null,
					}),
					{ status: 200 },
				),
			),
		);

		renderColumnDetailPage(queryClient);

		fireEvent.change(screen.getByLabelText(/column name/i), {
			target: { value: "Review" },
		});
		fireEvent.change(screen.getByLabelText(/description/i), {
			target: { value: "Ready for feedback" },
		});
		fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

		await waitFor(() =>
			expect(navigateMock).toHaveBeenCalledWith({
				to: "/projects/$projectId",
				params: { projectId: "project-1" },
			}),
		);
	});

	it("disables delete with helper text for final and non-empty columns", () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column(),
		]);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "user-1",
		});

		const { rerender } = renderColumnDetailPage(queryClient);

		expect(
			screen.getByRole("button", { name: /delete column/i }),
		).toHaveProperty("disabled", true);
		expect(
			screen.getByText("You cannot delete the final project column."),
		).toBeTruthy();

		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column(),
			column({ id: "column-2", name: "Done" }),
		]);
		queryClient.setQueryData(projectTasksQueryOptions("project-1").queryKey, [
			task(),
		]);
		rerender(
			<QueryClientProvider client={queryClient}>
				<ColumnDetailPage />
			</QueryClientProvider>,
		);

		expect(
			screen.getByRole("button", { name: /delete column/i }),
		).toHaveProperty("disabled", true);
		expect(
			screen.getByText(
				"Move or remove this column's tasks before deleting it.",
			),
		).toBeTruthy();
	});

	it("confirms deletion, sends DELETE, and navigates back to the board", async () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column(),
			column({ id: "column-2", name: "Done" }),
		]);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "user-1",
		});
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response(null, { status: 204 }));
		vi.stubGlobal("fetch", fetchMock);
		vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));

		renderColumnDetailPage(queryClient);

		fireEvent.change(screen.getByLabelText(/column name/i), {
			target: { value: "Unsaved Backlog" },
		});
		fireEvent.click(screen.getByRole("button", { name: /delete column/i }));

		await waitFor(() =>
			expect(window.confirm).toHaveBeenCalledWith(
				'Delete "Backlog"? Unsaved edits will be discarded.',
			),
		);
		expect(fetchMock.mock.calls[0][0]).toBe(
			"https://api.example.test/projects/project-1/columns/column-1",
		);
		expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
		await waitFor(() =>
			expect(navigateMock).toHaveBeenCalledWith({
				to: "/projects/$projectId",
				params: { projectId: "project-1" },
			}),
		);
	});

	it("shows a safe delete failure message and stays recoverable", async () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
			column(),
			column({ id: "column-2", name: "Done" }),
		]);
		queryClient.setQueryData(
			projectTasksQueryOptions("project-1").queryKey,
			[],
		);
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "user-1",
		});
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response("{}", { status: 409 })),
		);
		vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));

		renderColumnDetailPage(queryClient);

		fireEvent.click(screen.getByRole("button", { name: /delete column/i }));

		await waitFor(() =>
			expect(
				screen.getByText("Column could not be deleted. Please try again."),
			).toBeTruthy(),
		);
		expect(navigateMock).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: /save changes/i })).toBeTruthy();
	});
});
