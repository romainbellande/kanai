import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BarChart3, ChevronRight, LayoutDashboard } from "lucide-react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

import { type ProjectDashboardChart, useKanaiApi } from "#/api/client";

const WIDE_CHART_TITLES: Record<string, true> = {
	"Cumulative Flow Diagram": true,
	"Forecast cone": true,
};

const CHART_COLORS = [
	"var(--primary)",
	"var(--tertiary)",
	"var(--secondary)",
	"var(--error)",
	"var(--outline)",
] as const;

type DashboardChartDatum = {
	label: string;
	[key: string]: number | string;
};

type DashboardChartSeries = {
	name: string;
	dataKey: string;
	color: string;
};

export function ProjectDashboardPage({ projectId }: { projectId: string }) {
	const api = useKanaiApi();
	const projectQuery = useQuery({
		...api.projects.get(projectId),
		retry: false,
	});
	const dashboardQuery = useQuery({
		...api.dashboard.get(projectId),
		enabled: projectQuery.isSuccess,
		retry: false,
	});

	if (projectQuery.isPending) {
		return <ProjectDashboardLoading />;
	}

	if (projectQuery.isError) {
		return (
			<ProjectDashboardError
				message="Project Dashboard could not be loaded."
				onRetry={() => void projectQuery.refetch()}
			/>
		);
	}

	return (
		<main className="min-h-screen bg-[var(--surface)] px-4 py-6 sm:px-6 lg:px-8">
			<div className="mx-auto max-w-7xl">
				<nav className="flex items-center gap-2 text-sm text-[var(--on-surface-variant)]">
					<Link
						to="/"
						className="text-inherit no-underline hover:text-[var(--primary)]"
					>
						Projects
					</Link>
					<ChevronRight className="h-4 w-4" />
					<Link
						to="/projects/$projectId"
						params={{ projectId }}
						className="text-inherit no-underline hover:text-[var(--primary)]"
					>
						{projectQuery.data.name}
					</Link>
					<ChevronRight className="h-4 w-4" />
					<span>Dashboard</span>
				</nav>

				<header className="mt-6 flex flex-wrap items-start justify-between gap-4 rounded-[1.75rem] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-6 shadow-sm">
					<div>
						<p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--on-surface-variant)]">
							<LayoutDashboard className="h-4 w-4" />
							Project Dashboard
						</p>
						<h1 className="mt-3 font-display text-3xl font-bold text-[var(--on-surface)]">
							{projectQuery.data.name} analytics
						</h1>
						<p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--on-surface-variant)]">
							Charts stay empty until Project Task Change Events exist. No
							historical data is inferred from current task state.
						</p>
					</div>
					<Link
						to="/projects/$projectId"
						params={{ projectId }}
						className="rounded-full border border-[var(--outline-variant)] px-4 py-2 text-sm font-bold text-[var(--on-surface)] no-underline hover:bg-[var(--surface-container-low)]"
					>
						Back to board
					</Link>
				</header>

				{dashboardQuery.isPending ? <ProjectDashboardLoading inline /> : null}
				{dashboardQuery.isError ? (
					<ProjectDashboardError
						message="Dashboard charts could not be loaded."
						onRetry={() => void dashboardQuery.refetch()}
					/>
				) : null}
				{dashboardQuery.data ? (
					<section
						aria-label="Project Dashboard charts"
						className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2"
					>
						{dashboardQuery.data.charts.map((chart) => (
							<ProjectDashboardChartCard key={chart.key} chart={chart} />
						))}
					</section>
				) : null}
			</div>
		</main>
	);
}

function ProjectDashboardLoading({ inline = false }: { inline?: boolean }) {
	return (
		<output
			aria-label="Loading Project Dashboard"
			className={[
				"flex animate-pulse flex-col gap-4 rounded-[1.75rem] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-6 text-sm font-semibold text-[var(--on-surface-variant)]",
				inline ? "mt-6" : "min-h-screen",
			].join(" ")}
		>
			Loading Project Dashboard...
			<div className="grid gap-4 md:grid-cols-2">
				<div className="h-40 rounded-2xl bg-[var(--surface-container-high)]" />
				<div className="h-40 rounded-2xl bg-[var(--surface-container-high)]" />
			</div>
		</output>
	);
}

function ProjectDashboardError({
	message,
	onRetry,
}: {
	message: string;
	onRetry: () => void;
}) {
	return (
		<div className="mt-6 rounded-[1.5rem] border border-[var(--error)] bg-[var(--error-container)] p-5 text-[var(--on-error-container)]">
			<p className="text-sm font-bold">{message}</p>
			<button
				type="button"
				onClick={onRetry}
				className="mt-3 rounded-full bg-[var(--surface-container-lowest)] px-4 py-2 text-sm font-bold text-[var(--on-surface)]"
			>
				Retry
			</button>
		</div>
	);
}

function ProjectDashboardChartCard({
	chart,
}: {
	chart: ProjectDashboardChart;
}) {
	const isWide = WIDE_CHART_TITLES[chart.title] === true;
	const hasData =
		chart.entries.length > 0 ||
		chart.series.some((series) => series.entries.length > 0);
	const latestEntry = chart.entries.at(-1);
	const latestValues = Object.entries(latestEntry?.values ?? {});

	return (
		<article
			className={[
				"rounded-[1.5rem] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5 shadow-sm",
				isWide ? "md:col-span-2" : "",
			].join(" ")}
		>
			<div className="flex items-start justify-between gap-3">
				<div>
					<h2 className="font-display text-xl font-bold text-[var(--on-surface)]">
						{chart.title}
					</h2>
					<p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
						Event-backed analytics
					</p>
				</div>
				<BarChart3 className="h-5 w-5 text-[var(--on-surface-variant)]" />
			</div>

			<div className="mt-5 rounded-2xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
				{hasData ? (
					<div className="space-y-3 text-sm text-[var(--on-surface-variant)]">
						<ul className="flex flex-wrap gap-2">
							{chart.series.map((series) => (
								<li
									key={series.name}
									className="rounded-full bg-[var(--surface-container-high)] px-3 py-1 font-semibold"
								>
									{series.name}
								</li>
							))}
						</ul>
						<DashboardChartVisualization chart={chart} />
						{chart.title === "Velocity chart" ? (
							<VelocityChartSummary chart={chart} />
						) : null}
						{chart.title === "Forecast cone" ? (
							<ForecastCone chart={chart} />
						) : null}
						{latestEntry ? (
							<p className="font-semibold">
								Latest event {latestEntry.label}
								{latestValues.length > 0 ? ": " : ""}
								{latestValues.map(([key, value], index) => (
									<span key={key}>
										{index > 0 ? ", " : ""}
										{key.replaceAll("_", " ")} {value ?? "none"}
									</span>
								))}
							</p>
						) : null}
					</div>
				) : (
					<p className="text-sm leading-6 text-[var(--on-surface-variant)]">
						{chart.emptyState?.message ?? "No chart data available yet."}
					</p>
				)}
			</div>
		</article>
	);
}

function DashboardChartVisualization({
	chart,
}: {
	chart: ProjectDashboardChart;
}) {
	const visualization = buildDashboardChartVisualization(chart);
	if (!visualization) return null;

	const Chart = prefersBarChart(chart.title) ? BarChart : LineChart;

	return (
		<div
			role="img"
			aria-label={`${chart.title} dashboard chart visualization`}
			className="h-64 rounded-2xl bg-[var(--surface-container-lowest)] p-3"
		>
			<ResponsiveContainer
				width="100%"
				height="100%"
				initialDimension={{ width: 640, height: 240 }}
				minHeight={240}
				minWidth={0}
			>
				<Chart
					data={visualization.data}
					margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
				>
					<CartesianGrid
						stroke="var(--outline-variant)"
						strokeDasharray="3 3"
						vertical={false}
					/>
					<XAxis
						dataKey="label"
						tick={{ fill: "var(--on-surface-variant)", fontSize: 12 }}
						tickLine={false}
					/>
					<YAxis
						allowDecimals={false}
						tick={{ fill: "var(--on-surface-variant)", fontSize: 12 }}
						tickLine={false}
						width={40}
					/>
					<Tooltip
						contentStyle={{
							background: "var(--surface-container-lowest)",
							border: "1px solid var(--outline-variant)",
							borderRadius: "1rem",
							color: "var(--on-surface)",
						}}
					/>
					{visualization.series.map((series) =>
						prefersBarChart(chart.title) ? (
							<Bar
								key={series.dataKey}
								dataKey={series.dataKey}
								fill={series.color}
								name={series.name}
								radius={[6, 6, 0, 0]}
							/>
						) : (
							<Line
								key={series.dataKey}
								type="monotone"
								dataKey={series.dataKey}
								dot={{ r: 3 }}
								name={series.name}
								stroke={series.color}
								strokeWidth={2}
							/>
						),
					)}
				</Chart>
			</ResponsiveContainer>
		</div>
	);
}

function buildDashboardChartVisualization(
	chart: ProjectDashboardChart,
): { data: DashboardChartDatum[]; series: DashboardChartSeries[] } | null {
	if (chart.series.length > 0) {
		const dataByLabel = new Map<string, DashboardChartDatum>();
		const series = chart.series
			.map((chartSeries, index) => {
				const dataKey = `series_${index}`;
				for (const entry of chartSeries.entries) {
					const value = numericValueForSeries(chartSeries.name, entry.values);
					if (value === null) continue;
					const datum = dataByLabel.get(entry.label) ?? { label: entry.label };
					datum[dataKey] = value;
					dataByLabel.set(entry.label, datum);
				}
				return {
					name: chartSeries.name,
					dataKey,
					color: CHART_COLORS[index % CHART_COLORS.length],
				};
			})
			.filter((chartSeries) =>
				Array.from(dataByLabel.values()).some(
					(datum) => typeof datum[chartSeries.dataKey] === "number",
				),
			);

		if (series.length > 0) {
			return { data: Array.from(dataByLabel.values()), series };
		}
	}

	const numericKeys = Array.from(
		new Set(
			chart.entries.flatMap((entry) =>
				Object.entries(entry.values)
					.filter(([, value]) => typeof value === "number")
					.map(([key]) => key),
			),
		),
	);
	if (numericKeys.length === 0) return null;

	return {
		data: chart.entries.map((entry) => ({
			label: entry.label,
			...Object.fromEntries(
				numericKeys.map((key) => [key, numberValue(entry.values[key])]),
			),
		})),
		series: numericKeys.map((key, index) => ({
			name: titleizeMetricKey(key),
			dataKey: key,
			color: CHART_COLORS[index % CHART_COLORS.length],
		})),
	};
}

function numericValueForSeries(
	seriesName: string,
	values: Record<string, number | string | null>,
): number | null {
	const preferredKey = metricKeyForSeriesName(seriesName);
	if (typeof values[preferredKey] === "number") {
		return values[preferredKey];
	}

	const numericEntry = Object.values(values).find(
		(value) => typeof value === "number",
	);
	return typeof numericEntry === "number" ? numericEntry : null;
}

function metricKeyForSeriesName(seriesName: string): string {
	return seriesName
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "_")
		.replaceAll(/^_+|_+$/g, "");
}

function titleizeMetricKey(key: string): string {
	return key
		.replaceAll("_", " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function prefersBarChart(title: string): boolean {
	return ![
		"Burndown chart",
		"Burnup chart",
		"Cumulative Flow Diagram",
		"Forecast cone",
	].includes(title);
}

function VelocityChartSummary({ chart }: { chart: ProjectDashboardChart }) {
	const velocityEntries = chart.entries.map((entry) => ({
		label: entry.label,
		completedStoryPoints: numberValue(entry.values.completed_story_points),
		finishedTaskCount: numberValue(entry.values.finished_task_count),
		unestimatedFinishedTasks: numberValue(
			entry.values.unestimated_finished_tasks,
		),
	}));

	return (
		<div className="space-y-2 rounded-2xl bg-[var(--surface-container-lowest)] p-3">
			{velocityEntries.map((entry) => (
				<p key={entry.label} className="text-xs">
					{entry.completedStoryPoints} pts, {entry.finishedTaskCount} finished
					tasks, {entry.unestimatedFinishedTasks} unestimated
				</p>
			))}
		</div>
	);
}

function ForecastCone({ chart }: { chart: ProjectDashboardChart }) {
	const forecast = chart.entries.at(-1)?.values;
	if (!forecast) return null;

	const dates = [
		["Best", stringValue(forecast.best_forecast_date)],
		["Likely", stringValue(forecast.likely_forecast_date)],
		["Worst", stringValue(forecast.worst_forecast_date)],
	] as const;

	return (
		<div
			role="img"
			aria-label="Forecast cone data"
			className="grid gap-3 rounded-2xl bg-[var(--surface-container-lowest)] p-3 sm:grid-cols-3"
		>
			{dates.map(([label, date]) => (
				<div
					key={label}
					className="rounded-xl border border-[var(--outline-variant)] p-3"
				>
					<p className="text-xs font-bold uppercase tracking-[0.14em]">
						{label}
					</p>
					<p className="mt-1 font-display text-lg font-bold text-[var(--on-surface)]">
						{date ?? "Not available"}
					</p>
				</div>
			))}
			<p className="sm:col-span-3">
				Estimated remaining story points{" "}
				{numberValue(forecast.estimated_remaining_story_points)}; unestimated
				tasks {numberValue(forecast.unestimated_tasks)}.
			</p>
		</div>
	);
}

function numberValue(value: number | string | null | undefined): number {
	return typeof value === "number" ? value : 0;
}

function stringValue(value: number | string | null | undefined): string | null {
	return typeof value === "string" ? value : null;
}
