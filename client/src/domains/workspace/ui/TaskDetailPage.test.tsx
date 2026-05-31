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
	type Project,
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
	useParams: () => ({ projectId: "project-1", taskId: "task-1" }),
}));

function task(overrides: Partial<Task> = {}): Task {
	return {
		id: "task-1",
		projectId: "project-1",
		title: "Original Task",
		status: "todo",
		priority: "medium",
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

function renderTaskDetailPage(
	ui: ReactNode,
	queryClient = createTestQueryClient(),
) {
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
		const updatedTask = task({
			description: "Updated notes",
			priority: "high",
			title: "Updated Task",
		});
		const updatedTaskJson = {
			id: updatedTask.id,
			project_id: updatedTask.projectId,
			title: updatedTask.title,
			status: updatedTask.status,
			priority: updatedTask.priority,
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

		fireEvent.change(screen.getByLabelText("Task Title"), {
			target: { value: "Updated Task" },
		});
		fireEvent.change(screen.getByLabelText("Priority"), {
			target: { value: "high" },
		});
		fireEvent.change(screen.getByLabelText("Description"), {
			target: { value: "Updated notes" },
		});
		fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

		await screen.findByText("Task changes saved.");
		const [, init] = fetchSpy.mock.calls[0];
		expect(JSON.parse(String(init?.body))).toMatchObject({
			description: "Updated notes",
			priority: "high",
			title: "Updated Task",
		});
		expect(
			queryClient.getQueryData<Task[]>(
				projectTasksQueryOptions("project-1").queryKey,
			)?.[0].title,
		).toBe("Updated Task");
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
});
