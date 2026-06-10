// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
	currentUserQueryOptions,
	projectColumnsQueryOptions,
	projectQueryOptions,
} from "#/api/client";

const routeMocks = vi.hoisted(() => ({
	search: { column_id: undefined as string | undefined },
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
	createFileRoute: () => (config: Record<string, unknown>) => ({
		...config,
		useSearch: () => routeMocks.search,
	}),
	lazyRouteComponent: () => () => null,
	useNavigate: () => vi.fn(),
	useParams: () => ({ projectId: "project-1" }),
}));

type TestRoute = {
	component: ComponentType;
	validateSearch: (search: Record<string, unknown>) => { column_id?: string };
};

function createQueryClient() {
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
	queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
		{
			id: "column-backlog",
			projectId: "project-1",
			name: "Backlog",
			description: null,
			position: 0,
			createdAt: null,
			updatedAt: null,
		},
		{
			id: "column-review",
			projectId: "project-1",
			name: "Review",
			description: null,
			position: 1,
			createdAt: null,
			updatedAt: null,
		},
	]);
	return queryClient;
}

describe("new task route", () => {
	it("accepts only column_id for workflow preselection", async () => {
		const { Route } = await import("#/routes/projects_.$projectId.tasks.new");
		const route = Route as unknown as TestRoute;

		expect(
			route.validateSearch({ column_id: "column-review", status: "todo" }),
		).toEqual({ column_id: "column-review" });
		expect(route.validateSearch({ status: "todo" })).toEqual({
			column_id: undefined,
		});
	});

	it("passes the route column id to the create task page", async () => {
		const { Route } = await import("#/routes/projects_.$projectId.tasks.new");
		const route = Route as unknown as TestRoute;
		const RouteComponent = route.component;
		routeMocks.search = { column_id: "column-review" };

		render(
			<QueryClientProvider client={createQueryClient()}>
				<RouteComponent />
			</QueryClientProvider>,
		);

		expect(screen.getByLabelText<HTMLSelectElement>("Workflow").value).toBe(
			"column-review",
		);
	});
});
