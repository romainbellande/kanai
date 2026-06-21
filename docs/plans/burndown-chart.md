# Plan: Burndown chart in project view

## Objective

Add a burndown chart (story points + task count) to the active sprint summary and each closed sprint history card. Computed client-side from data the page already loads. No backend changes, no new endpoint, no schema change, no migration.

Design is fully resolved in `docs/adr/0006-burndown-stateless-approximation.md`.

## Steps

### Step 1: Install recharts

```bash
cd client && bun install recharts
```

### Step 2: Create `BurndownChart.tsx`

**Path:** `client/src/domains/workspace/ui/BurndownChart.tsx`

Colocated with `ProjectBoardPage.tsx`. Exports:

1. `buildBurndownSeries(props) → ChartDataPoint[]` — pure function, the thing to unit test.
   - Active sprint: 2 data points — `(plannedStartDate, total)` and `(today, remaining)`, clamped to `[plannedStartDate, plannedEndDate]`.
   - Closed sprint: 1 data point — `(closedAt, remaining)`.
   - `today` is a param for testability.

2. `BurndownChart` component — recharts `LineChart` in a `ResponsiveContainer`:
   - Dual lines: story points (left axis) and task count (right axis).
   - `ReferenceLine` for the ideal diagonal from `(start, total)` to `(end, 0)`.
   - `Tooltip` with date, points, tasks.
   - Compact (~300px tall) to fit below existing progress UI.

**Props:**
```typescript
type BurndownChartProps = {
  plannedStartDate: string;
  plannedEndDate: string;
  closedAt?: string;
  totalPoints: number;
  totalTasks: number;
  remainingPoints: number;
  remainingTasks: number;
};
```

### Step 3: Wire into `ActiveSprintSummary`

Import `BurndownChart`, render below the story point progress `<div>`. Gate on `hasDoneColumn && estimatedPoints > 0`.

### Step 4: Wire into `ProjectSprintHistoryView`

Import `BurndownChart`, render inside each history `<article>` below the Historical Story Point split. Use `entry.sprint.*` dates, `pointSummary.unfinishedPoints` for remaining points, `entry.unfinishedCount` for remaining tasks.

### Step 5: Tests

Two tests:
1. **Pure function test** — `buildBurndownSeries` with active sprint, closed sprint, clamping, zero edges.
2. **Smoke render** — `<BurndownChart>` renders without crash.

### Step 6: Verify

```bash
cd client && bun --bun run check && bun --bun run test
cd .. && just pre-commit
```

## What NOT to do

- No backend changes. Do not touch `api/`.
- No new database tables, migrations, or tasks.
- No scheduler, no webhook, no event log.
- No new API endpoint or query key.
- No removal of existing `SprintProgressBar` or chips — additive only.
