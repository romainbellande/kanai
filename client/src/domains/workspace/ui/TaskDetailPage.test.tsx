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
