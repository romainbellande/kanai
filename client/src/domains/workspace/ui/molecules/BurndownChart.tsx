import {
	Line,
	LineChart,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

export type BurndownPoint = {
	timestampMs: number;
	label: string;
	points: number | null;
	tasks: number;
};

export type BurndownSeriesInput = {
	plannedStartDate: string;
	plannedEndDate: string;
	totalPoints: number;
	remainingPoints: number;
	remainingTasks: number;
	totalTasks: number;
	closedAt?: string | null;
};

function toTimestamp(value: string): number {
	const ms = Date.parse(value);
	return Number.isNaN(ms) ? 0 : ms;
}

function clampToday(startMs: number, endMs: number): number {
	const now = Date.now();
	if (endMs > 0 && now > endMs) return endMs;
	if (startMs > 0 && now < startMs) return startMs;
	return now;
}

function formatDay(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10);
}

// ponytail: 2 deterministic points for active sprint, 1 for closed. Today clamped to sprint window.
export function buildBurndownSeries(
	input: BurndownSeriesInput,
): BurndownPoint[] {
	const startMs = toTimestamp(input.plannedStartDate);
	const endMs = toTimestamp(input.plannedEndDate);
	const totalPoints = Math.max(0, input.totalPoints);
	const totalTasks = Math.max(0, input.totalTasks);

	const start: BurndownPoint = {
		timestampMs: startMs,
		label: formatDay(startMs),
		points: totalPoints,
		tasks: totalTasks,
	};

	if (input.closedAt) {
		const closedMs = toTimestamp(input.closedAt);
		const close: BurndownPoint = {
			timestampMs: closedMs,
			label: formatDay(closedMs),
			points: Math.max(0, input.remainingPoints),
			tasks: Math.max(0, input.remainingTasks),
		};
		return [start, close];
	}

	const todayMs = clampToday(startMs, endMs);
	const today: BurndownPoint = {
		timestampMs: todayMs,
		label: formatDay(todayMs),
		points: Math.max(0, input.remainingPoints),
		tasks: Math.max(0, input.remainingTasks),
	};

	// ponytail: dedup if start == today (single-point sprint just started)
	if (startMs === todayMs) return [today];
	return [start, today];
}

export type BurndownChartProps = BurndownSeriesInput;

export function BurndownChart(props: BurndownChartProps) {
	const series = buildBurndownSeries(props);
	const totalPoints = Math.max(0, props.totalPoints);
	const totalTasks = Math.max(0, props.totalTasks);
	const endMs = toTimestamp(props.plannedEndDate);
	const startMs = toTimestamp(props.plannedStartDate);

	return (
		<div
			aria-label="Sprint burndown chart"
			role="img"
			className="mt-4 h-56 w-full rounded-2xl bg-[var(--surface-container-lowest)] p-3"
		>
			<ResponsiveContainer width="100%" height="100%">
				<LineChart
					data={series}
					margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
				>
					<XAxis
						dataKey="timestampMs"
						tickFormatter={(ms: number) => formatDay(ms)}
						tick={{ fontSize: 11 }}
						stroke="var(--outline)"
						type="number"
						domain={[
							startMs > 0 ? startMs : "dataMin",
							endMs > 0 ? endMs : "dataMax",
						]}
					/>
					<YAxis
						yAxisId="points"
						tick={{ fontSize: 11 }}
						stroke="var(--outline)"
						allowDecimals={false}
					/>
					<YAxis
						yAxisId="tasks"
						orientation="right"
						tick={{ fontSize: 11 }}
						stroke="var(--outline)"
						allowDecimals={false}
					/>
					<Tooltip
						labelFormatter={(label) => formatDay(Number(label))}
						contentStyle={{
							background: "var(--surface-container-high)",
							border: "1px solid var(--outline-variant)",
							borderRadius: "0.75rem",
							fontSize: "0.75rem",
						}}
					/>
					<ReferenceLine
						yAxisId="points"
						segment={
							startMs > 0 && endMs > 0
								? [
										{ x: startMs, y: totalPoints },
										{ x: endMs, y: 0 },
									]
								: undefined
						}
						stroke="var(--outline-variant)"
						strokeDasharray="4 4"
						ifOverflow="extendDomain"
					/>
					<ReferenceLine
						yAxisId="tasks"
						segment={
							startMs > 0 && endMs > 0
								? [
										{ x: startMs, y: totalTasks },
										{ x: endMs, y: 0 },
									]
								: undefined
						}
						stroke="var(--outline-variant)"
						strokeDasharray="2 2"
						ifOverflow="extendDomain"
					/>
					<Line
						yAxisId="points"
						type="monotone"
						dataKey="points"
						name="Story points"
						stroke="var(--primary)"
						strokeWidth={2}
						dot={{ r: 3 }}
						connectNulls
					/>
					<Line
						yAxisId="tasks"
						type="monotone"
						dataKey="tasks"
						name="Tasks"
						stroke="var(--tertiary)"
						strokeWidth={2}
						dot={{ r: 3 }}
					/>
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
}
