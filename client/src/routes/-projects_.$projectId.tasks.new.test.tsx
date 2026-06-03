// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
	search: { column_id: undefined as string | undefined },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();

	return {
		...actual,
		createFileRoute: () => (config: Record<string, unknown>) => ({
			...config,
			useSearch: () => routeMocks.search,
		}),
	};
});

vi.mock("#/domains/workspace/ui/CreateTaskPage", () => ({
	CreateTaskPage: ({ initialColumnId }: { initialColumnId?: string }) => (
		<div>Initial column: {initialColumnId ?? "none"}</div>
	),
}));

type TestRoute = {
	component: ComponentType;
	validateSearch: (search: Record<string, unknown>) => { column_id?: string };
};

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

		render(<RouteComponent />);

		expect(screen.getByText("Initial column: column-review")).toBeTruthy();
	});
});
