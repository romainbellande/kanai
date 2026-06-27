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
	type ProjectDashboard,
	projectDashboardQueryOptions,
	projectQueryOptions,
} from "#/api/client";
import { ProjectDashboardPage } from "#/domains/workspace/ui/ProjectDashboardPage";

const routerMockState = vi.hoisted(() => ({
	params: { projectId: "project-1" },
}));
vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: { component: () => ReactNode }) => ({
		...options,
		useParams: () => routerMockState.params,
	}),
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

const chartTitles = [
	"Burndown chart",
	"Burnup chart",
	"Scope change chart",
	"Velocity chart",
	"Cumulative Flow Diagram",
	"Cycle time chart",
	"Throughput chart",
	"Blocked work chart",
	"Defect / rework chart",
	"Forecast cone",
	"Work aging chart",
];

function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
		},
	});
}

function project(overrides: Partial<Project> = {}): Project {
	return {
		id: "project-1",
		name: "Dashboard Project",
		code: "DSH",
		description: null,
		status: "active",
		ownerIds: [],
		memberIds: [],
		createdAt: null,
		updatedAt: null,
		...overrides,
	};
}

function dashboard(): ProjectDashboard {
	return {
		projectId: "project-1",
		generatedAt: new Date("2026-06-22T10:00:00Z"),
		charts: chartTitles.map((title) => ({
			key: title.toLowerCase().replaceAll(" ", "-"),
			title,
			series: [],
			entries: [],
			emptyState: {
				reason: "no_project_task_change_events",
				message: "Waiting for Project Task Change Events.",
			},
		})),
	};
}

function eventBackedDashboard(): ProjectDashboard {
	const base = dashboard();
	return {
		...base,
		charts: base.charts.map((chart) => {
			if (chart.title === "Burndown chart") {
				return eventBackedChart(chart, "Remaining Sprint Scope", {
					remaining_story_points: 8,
					unestimated_tasks: 1,
				});
			}
			if (chart.title === "Burnup chart") {
				return {
					...eventBackedChart(chart, "Sprint Scope", {
						sprint_scope: 8,
						unestimated_tasks: 1,
					}),
					series: [
						{
							name: "Completed Story Points",
							entries: [
								{
									label: "2026-06-22",
									values: { completed_story_points: 0 },
								},
							],
						},
						{
							name: "Sprint Scope",
							entries: [
								{
									label: "2026-06-22",
									values: { sprint_scope: 8, unestimated_tasks: 1 },
								},
							],
						},
					],
				};
			}
			if (chart.title === "Scope change chart") {
				return {
					...eventBackedChart(chart, "Added Story Points", {
						sprint_scope: 8,
						scope_delta: 3,
						added_story_points: 3,
						removed_story_points: 0,
						tasks_added: 0,
						tasks_removed: 0,
						unestimated_tasks: 1,
						unestimated_tasks_added: 0,
						unestimated_tasks_removed: 0,
					}),
					series: [
						{
							name: "Added Story Points",
							entries: [
								{
									label: "2026-06-22",
									values: {
										added_story_points: 3,
										tasks_added: 0,
										unestimated_tasks_added: 0,
									},
								},
							],
						},
						{
							name: "Removed Story Points",
							entries: [
								{
									label: "2026-06-22",
									values: {
										removed_story_points: 0,
										tasks_removed: 0,
										unestimated_tasks_removed: 0,
									},
								},
							],
						},
					],
				};
			}
			if (chart.title === "Velocity chart") {
				return eventBackedChart(chart, "Completed Story Points", {
					completed_story_points: 13,
					finished_task_count: 4,
					unestimated_finished_tasks: 1,
				});
			}
			if (chart.title === "Cumulative Flow Diagram") {
				return {
					...eventBackedChart(chart, "Customer Sign-off", {
						task_count: 2,
						workflow_column_position: 5,
					}),
					series: [
						{
							name: "Discovery",
							entries: [
								{
									label: "2026-06-22",
									values: {
										task_count: 0,
										workflow_column_name: "Discovery",
									},
								},
							],
						},
						{
							name: "Customer Sign-off",
							entries: [
								{
									label: "2026-06-22",
									values: {
										task_count: 2,
										workflow_column_name: "Customer Sign-off",
									},
								},
							],
						},
					],
					entries: [
						{
							label: "2026-06-22",
							values: {
								from_column_name: "Discovery",
								to_column_name: "Customer Sign-off",
								"Customer Sign-off": 2,
							},
						},
					],
					emptyState: null,
				};
			}
			if (chart.title === "Cycle time chart") {
				return eventBackedChart(chart, "Project Task Cycle Time", {
					task_id: "task-cycle-1",
					cycle_time_days: 2,
					average_cycle_time_days: 2,
					completed_task_count: 1,
				});
			}
			if (chart.title === "Throughput chart") {
				return eventBackedChart(chart, "Finished Tasks", {
					finished_task_count: 6,
				});
			}
			if (chart.title === "Forecast cone") {
				return eventBackedChart(chart, "Forecast dates", {
					best_forecast_date: "2026-07-06",
					likely_forecast_date: "2026-07-13",
					worst_forecast_date: "2026-07-27",
					estimated_remaining_story_points: 30,
					unestimated_tasks: 2,
				});
			}
			if (chart.title === "Blocked work chart") {
				return eventBackedChart(chart, "Blocked Project Tasks", {
					blocked_count: 2,
					oldest_blocked_age_days: 3,
				});
			}
			if (chart.title === "Defect / rework chart") {
				return eventBackedChart(chart, "Reworked Tasks", {
					reworked_task_count: 2,
					cumulative_reworked_task_count: 5,
				});
			}
			if (chart.title === "Work aging chart") {
				return eventBackedChart(chart, "Active Sprint Task Age", {
					task_id: "task-aging-1",
					work_age_days: 4,
					started_at: "2026-06-18T10:00:00+00:00",
				});
			}
			return chart;
		}),
	};
}

function eventBackedChart(
	chart: ProjectDashboard["charts"][number],
	seriesName: string,
	values: Record<string, number | string | null>,
): ProjectDashboard["charts"][number] {
	return {
		...chart,
		series: [
			{
				name: seriesName,
				entries: [{ label: "2026-06-22", values }],
			},
		],
		entries: [{ label: "2026-06-22", values }],
		emptyState: null,
	};
}

function renderWithQueryClient(
	ui: ReactNode,
	queryClient = createTestQueryClient(),
) {
	return render(
		<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
	);
}

describe("ProjectDashboardPage", () => {
	beforeEach(() => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "dashboard-token" }),
		);
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		window.sessionStorage.clear();
	});

	it("renders through the dashboard file route using the project id param", async () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(
			projectDashboardQueryOptions("project-1").queryKey,
			dashboard(),
		);
		routerMockState.params = { projectId: "project-1" };
		const { Route } = await import("#/routes/projects_.$projectId.dashboard");
		const DashboardRouteComponent = (
			Route as unknown as { component: () => ReactNode }
		).component;

		renderWithQueryClient(<DashboardRouteComponent />, queryClient);

		expect(
			screen.getByRole("heading", { name: "Dashboard Project analytics" }),
		).toBeTruthy();
		expect(
			screen.getByRole("heading", { name: "Burndown chart" }),
		).toBeTruthy();
	});

	it("uses cached Project context when navigating between board and dashboard", () => {
		const queryClient = createTestQueryClient();
		const fetchSpy = vi.fn<typeof fetch>();
		vi.stubGlobal("fetch", fetchSpy);
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project({ name: "Board Context Project" }),
		);
		queryClient.setQueryData(
			projectDashboardQueryOptions("project-1").queryKey,
			dashboard(),
		);

		renderWithQueryClient(
			<ProjectDashboardPage projectId="project-1" />,
			queryClient,
		);

		expect(
			screen.getByRole("heading", { name: "Board Context Project analytics" }),
		).toBeTruthy();
		expect(screen.getByRole("link", { name: "Back to board" })).toHaveProperty(
			"href",
			expect.stringContaining("/projects/project-1"),
		);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("renders all dashboard chart cards with empty states and board navigation", () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(
			projectDashboardQueryOptions("project-1").queryKey,
			dashboard(),
		);

		renderWithQueryClient(
			<ProjectDashboardPage projectId="project-1" />,
			queryClient,
		);

		for (const title of chartTitles) {
			expect(screen.getByRole("heading", { name: title })).toBeTruthy();
		}
		expect(
			screen.getAllByText("Waiting for Project Task Change Events.").length,
		).toBe(chartTitles.length);
		expect(screen.getByRole("link", { name: "Back to board" })).toHaveProperty(
			"href",
			expect.stringContaining("/projects/project-1"),
		);
	});

	it("renders event-backed chart series context", () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(
			projectDashboardQueryOptions("project-1").queryKey,
			eventBackedDashboard(),
		);

		renderWithQueryClient(
			<ProjectDashboardPage projectId="project-1" />,
			queryClient,
		);

		expect(screen.getByText("Remaining Sprint Scope")).toBeTruthy();
		expect(screen.getAllByText("Completed Story Points")).toHaveLength(2);
		expect(screen.getByText("Sprint Scope")).toBeTruthy();
		expect(screen.getByText("Added Story Points")).toBeTruthy();
		expect(screen.getByText("Removed Story Points")).toBeTruthy();
		expect(screen.getByText("Discovery")).toBeTruthy();
		expect(screen.getByText("Customer Sign-off")).toBeTruthy();
		expect(screen.getByText("Blocked Project Tasks")).toBeTruthy();
		expect(screen.getByText("Reworked Tasks")).toBeTruthy();
		expect(screen.getByText("Finished Tasks")).toBeTruthy();
		expect(screen.getByText("Project Task Cycle Time")).toBeTruthy();
		expect(screen.getByText("Active Sprint Task Age")).toBeTruthy();
		expect(screen.getByText("Forecast dates")).toBeTruthy();
		expect(
			screen.getByRole("img", {
				name: "Velocity chart dashboard chart visualization",
			}),
		).toBeTruthy();
		expect(
			screen.getByText("13 pts, 4 finished tasks, 1 unestimated"),
		).toBeTruthy();
		expect(
			screen.getByRole("img", { name: "Forecast cone data" }),
		).toBeTruthy();
		expect(screen.getByText("Best")).toBeTruthy();
		expect(screen.getByText("Likely")).toBeTruthy();
		expect(screen.getByText("Worst")).toBeTruthy();
		expect(screen.getByText("2026-07-06")).toBeTruthy();
		expect(
			screen.getByText(
				(_, element) =>
					element?.textContent ===
					"Latest event 2026-06-22: remaining story points 8, unestimated tasks 1",
			),
		).toBeTruthy();
		expect(
			screen.getByText(
				(_, element) =>
					element?.textContent ===
					"Latest event 2026-06-22: completed story points 13, finished task count 4, unestimated finished tasks 1",
			),
		).toBeTruthy();
		expect(
			screen.getByText(
				(_, element) =>
					element?.textContent ===
					"Latest event 2026-06-22: from column name Discovery, to column name Customer Sign-off, Customer Sign-off 2",
			),
		).toBeTruthy();
		expect(
			screen.getByText(
				(_, element) =>
					element?.textContent ===
					"Latest event 2026-06-22: task id task-cycle-1, cycle time days 2, average cycle time days 2, completed task count 1",
			),
		).toBeTruthy();
		expect(
			screen.getByText(
				(_, element) =>
					element?.textContent ===
					"Latest event 2026-06-22: blocked count 2, oldest blocked age days 3",
			),
		).toBeTruthy();
		expect(
			screen.getByText(
				(_, element) =>
					element?.textContent ===
					"Latest event 2026-06-22: reworked task count 2, cumulative reworked task count 5",
			),
		).toBeTruthy();
		expect(
			screen.getByText(
				(_, element) =>
					element?.textContent ===
					"Latest event 2026-06-22: task id task-aging-1, work age days 4, started at 2026-06-18T10:00:00+00:00",
			),
		).toBeTruthy();
		expect(
			screen.getByText(
				(_, element) =>
					element?.textContent ===
					"Latest event 2026-06-22: best forecast date 2026-07-06, likely forecast date 2026-07-13, worst forecast date 2026-07-27, estimated remaining story points 30, unestimated tasks 2",
			),
		).toBeTruthy();
	});

	it("renders graphical charts for event-backed dashboard data", () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		queryClient.setQueryData(
			projectDashboardQueryOptions("project-1").queryKey,
			eventBackedDashboard(),
		);

		renderWithQueryClient(
			<ProjectDashboardPage projectId="project-1" />,
			queryClient,
		);

		expect(
			screen.getAllByRole("img", { name: /dashboard chart visualization/i })
				.length,
		).toBeGreaterThanOrEqual(10);
		expect(
			document.querySelectorAll("svg.recharts-surface").length,
		).toBeGreaterThanOrEqual(10);
	});

	it("shows loading, error, and retry states for the dashboard query", async () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(
			projectQueryOptions("project-1").queryKey,
			project(),
		);
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify({ detail: "Temporarily unavailable" }), {
				headers: { "content-type": "application/json" },
				status: 503,
			}),
		);
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(
			<ProjectDashboardPage projectId="project-1" />,
			queryClient,
		);

		expect(screen.getByLabelText("Loading Project Dashboard")).toBeTruthy();
		const retryButton = await screen.findByRole("button", { name: "Retry" });
		expect(
			screen.getByText("Dashboard charts could not be loaded."),
		).toBeTruthy();

		fireEvent.click(retryButton);

		await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
	});
});
