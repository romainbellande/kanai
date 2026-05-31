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

import { currentUserQueryOptions, projectQueryOptions } from "#/api/client";
import { TasksApi } from "#/api/openapi-client";

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

function renderWithQueryClient(ui: ReactNode) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
		},
	});
	queryClient.setQueryData(currentUserQueryOptions().queryKey, undefined);
	queryClient.setQueryData(projectQueryOptions("project-1").queryKey, {
		id: "project-1",
		name: "API Project",
	});

	return render(
		<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
	);
}

describe("CreateTaskPage", () => {
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
	});

	it("submits schema-compatible task data for the route project", async () => {
		const { CreateTaskPage } = await import(
			"#/domains/workspace/ui/CreateTaskPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		const createTask = vi
			.spyOn(TasksApi.prototype, "createTaskEndpointProjectsProjectIdTasksPost")
			.mockResolvedValue({ id: "task-1" });

		renderWithQueryClient(<CreateTaskPage />);
		fireEvent.change(screen.getByLabelText(/task title/i), {
			target: { value: "Persist task" },
		});
		fireEvent.change(screen.getByLabelText(/description/i), {
			target: { value: "Task notes" },
		});
		fireEvent.change(screen.getByLabelText(/acceptance criteria/i), {
			target: { value: "Done means done" },
		});
		fireEvent.submit(getCreateTaskForm());

		await waitFor(() => expect(createTask).toHaveBeenCalledTimes(1));
		expect(createTask).toHaveBeenCalledWith({
			projectId: "project-1",
			taskCreate: {
				title: "Persist task",
				status: "todo",
				priority: "medium",
				description: "Task notes",
				acceptanceCriteria: "Done means done",
			},
		});
		expect(routerMocks.navigate).toHaveBeenCalledWith({
			to: "/projects/$projectId",
			params: { projectId: "project-1" },
		});
	});

	it("shows validation failure without submitting", async () => {
		const { CreateTaskPage } = await import(
			"#/domains/workspace/ui/CreateTaskPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		const createTask = vi.spyOn(
			TasksApi.prototype,
			"createTaskEndpointProjectsProjectIdTasksPost",
		);

		renderWithQueryClient(<CreateTaskPage />);
		fireEvent.submit(getCreateTaskForm());

		expect(await screen.findByText("Task title is required.")).toBeTruthy();
		expect(createTask).not.toHaveBeenCalled();
	});

	it("keeps form input and shows an inline error when creation fails", async () => {
		const { CreateTaskPage } = await import(
			"#/domains/workspace/ui/CreateTaskPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		vi.spyOn(
			TasksApi.prototype,
			"createTaskEndpointProjectsProjectIdTasksPost",
		).mockRejectedValue(new Error("failed"));

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
