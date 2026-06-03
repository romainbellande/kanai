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
		position: 0,
		createdAt: null,
		updatedAt: null,
		...overrides,
	};
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
		priority: "medium",
		description: null,
		status: null,
		ownerIds: [],
		memberIds: [],
		createdAt: null,
		updatedAt: null,
	});
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
					priority: "medium",
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
			priority: "medium",
			description: "Task notes",
			acceptance_criteria: "Done means done",
		});
		expect(routerMocks.navigate).toHaveBeenCalledWith({
			to: "/projects/$projectId",
			params: { projectId: "project-1" },
		});
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
					priority: "medium",
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

		renderWithQueryClient(<CreateTaskPage initialStatus="column-review" />);
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
			priority: "medium",
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
			screen.getByText(
				"This project has no workflow columns. Add a workflow column before creating tasks.",
			),
		).toBeTruthy();
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
});
