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
	CurrentUserAuthError,
	currentUserQueryOptions,
	projectsQueryOptions,
} from "#/api/client";
import { ProjectsApi } from "#/api/openapi-client";

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
}));

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

describe("ProjectsPage", () => {
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
	});

	it("renders API projects and links by API project ID", async () => {
		const { ProjectsPage } = await import(
			"#/domains/workspace/ui/ProjectsPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(currentUserQueryOptions().queryKey, {
			id: "user-1",
			first_name: "Jane",
			last_name: "Doe",
		});
		queryClient.setQueryData(projectsQueryOptions().queryKey, [
			{
				id: "project-api-id",
				name: "Persisted Project",
				code: "PRS",
				priority: "high",
				description: "Loaded from API",
				status: "on-track",
				ownerIds: [],
				memberIds: [],
				createdAt: null,
				updatedAt: null,
			},
		]);

		renderWithQueryClient(<ProjectsPage />, queryClient);

		expect(screen.getByText("Persisted Project")).toBeTruthy();
		expect(screen.getByText("Loaded from API")).toBeTruthy();
		expect(screen.getByText("on-track")).toBeTruthy();
		expect(
			screen.getByRole("link", { name: /open board/i }).getAttribute("href"),
		).toBe("/projects/project-api-id");
		expect(screen.queryByText("Enterprise Launch")).toBeNull();
	});

	it("renders an empty state with a create-project link", async () => {
		const { ProjectsPage } = await import(
			"#/domains/workspace/ui/ProjectsPage"
		);
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(projectsQueryOptions().queryKey, []);

		renderWithQueryClient(<ProjectsPage />, queryClient);

		expect(screen.getByText("No projects yet.")).toBeTruthy();
		expect(
			screen
				.getByRole("link", { name: /create a project/i })
				.getAttribute("href"),
		).toBe("/projects/new");
	});

	it("renders an auth error with retry", async () => {
		const { ProjectsPage } = await import(
			"#/domains/workspace/ui/ProjectsPage"
		);
		const queryClient = createTestQueryClient();
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		const listProjects = vi
			.spyOn(ProjectsApi.prototype, "listProjectsProjectsGet")
			.mockRejectedValue(new CurrentUserAuthError());

		renderWithQueryClient(<ProjectsPage />, queryClient);
		fireEvent.click(await screen.findByRole("button", { name: /retry/i }));

		expect(
			screen.getByText("Sign in again to load your projects."),
		).toBeTruthy();
		await waitFor(() => expect(listProjects).toHaveBeenCalledTimes(2));
	});
});
