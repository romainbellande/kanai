// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
	BurndownChart,
	buildBurndownSeries,
} from "#/domains/workspace/ui/molecules/BurndownChart";

describe("buildBurndownSeries", () => {
	it("returns start + today for an active sprint", () => {
		const data = buildBurndownSeries({
			plannedStartDate: "2026-06-10",
			plannedEndDate: "2026-06-30",
			totalPoints: 100,
			totalTasks: 20,
			remainingPoints: 40,
			remainingTasks: 8,
		});

		const realPoints = data.filter((p) => p.points !== null);
		expect(realPoints).toHaveLength(2);
		expect(realPoints[0].points).toBe(100);
		expect(realPoints[0].tasks).toBe(20);
		expect(realPoints[1].points).toBe(40);
		expect(realPoints[1].tasks).toBe(8);
	});

	it("returns start + close for a closed sprint", () => {
		const data = buildBurndownSeries({
			plannedStartDate: "2026-06-10",
			plannedEndDate: "2026-06-30",
			totalPoints: 100,
			totalTasks: 20,
			remainingPoints: 30,
			remainingTasks: 6,
			closedAt: "2026-06-30",
		});

		expect(data).toHaveLength(2);
		expect(data[0].points).toBe(100);
		expect(data[0].tasks).toBe(20);
		expect(data[1].points).toBe(30);
		expect(data[1].tasks).toBe(6);
	});

	it("handles zero totals", () => {
		const data = buildBurndownSeries({
			plannedStartDate: "2026-06-10",
			plannedEndDate: "2026-06-30",
			totalPoints: 0,
			totalTasks: 0,
			remainingPoints: 0,
			remainingTasks: 0,
		});

		expect(data.length).toBeGreaterThan(0);
		expect(data[0].points).toBe(0);
		expect(data[0].tasks).toBe(0);
	});
});

describe("BurndownChart", () => {
	it("renders without crashing", () => {
		const { container } = render(
			<BurndownChart
				plannedStartDate="2026-06-10"
				plannedEndDate="2026-06-30"
				totalPoints={100}
				totalTasks={20}
				remainingPoints={40}
				remainingTasks={8}
			/>,
		);

		expect(
			container.querySelector('[aria-label="Sprint burndown chart"]'),
		).toBeTruthy();
	});
});
