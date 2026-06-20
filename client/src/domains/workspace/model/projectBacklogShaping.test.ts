import { describe, expect, it } from "vitest";

import {
	areProjectTaskDraftsStale,
	type EditableProjectTaskDraft,
	getProjectBacklogGraph,
	validateProjectTaskDrafts,
} from "./projectBacklogShaping";

function draft(
	overrides: Partial<EditableProjectTaskDraft>,
): EditableProjectTaskDraft {
	return {
		key: "a",
		title: "A",
		description: null,
		acceptanceCriteria: null,
		priority: null,
		storyPoints: null,
		assigneeId: null,
		tag: null,
		prerequisites: [],
		...overrides,
	};
}

describe("project backlog shaping helpers", () => {
	it("marks drafts stale when shared understanding changed", () => {
		expect(
			areProjectTaskDraftsStale({
				generatedFrom: "old",
				sharedUnderstanding: "new",
			}),
		).toBe(true);
	});

	it("validates blank titles, missing refs, duplicates, self refs, and cycles", () => {
		const existingTask = {
			id: "task-1",
			projectId: "project-1",
			sprintId: null,
			title: "API",
			columnId: "column-1",
			priority: null,
			storyPoints: null,
			rank: "U",
			backlogRank: "U",
			assigneeId: null,
			description: null,
			acceptanceCriteria: null,
			tag: null,
			createdAt: null,
			updatedAt: null,
			prerequisiteTaskIds: [],
		};
		const result = validateProjectTaskDrafts(
			[
				draft({
					key: "a",
					title: " ",
					prerequisites: [
						{ type: "draft", key: "a" },
						{ type: "draft", key: "missing" },
						{ type: "existing", taskId: "task-2" },
						{ type: "existing", taskId: "task-2" },
					],
				}),
				draft({
					key: "A",
					title: "Duplicate key",
				}),
				draft({
					key: "b",
					title: "B",
					prerequisites: [{ type: "draft", key: "c" }],
				}),
				draft({
					key: "c",
					title: "C",
					prerequisites: [{ type: "draft", key: "b" }],
				}),
			],
			[existingTask],
		);

		expect(result.canSave).toBe(false);
		expect(result.errorsByKey.a).toEqual(
			expect.arrayContaining([
				"Title is required.",
				"Task cannot depend on itself.",
				"Missing draft prerequisite.",
				"Missing existing prerequisite.",
				"Duplicate prerequisite.",
				"Draft keys must be unique.",
			]),
		);
		expect(result.errorsByKey.A).toContain("Draft keys must be unique.");
		expect(result.errorsByKey.b).toContain(
			"Draft prerequisites contain a cycle.",
		);
		expect(result.errorsByKey.c).toContain(
			"Draft prerequisites contain a cycle.",
		);
	});

	it("builds graph nodes and direct edge labels", () => {
		const graph = getProjectBacklogGraph(
			[
				draft({
					key: "b",
					title: "Build UI",
					prerequisites: [{ type: "existing", taskId: "task-1" }],
				}),
			],
			[
				{
					id: "task-1",
					projectId: "project-1",
					sprintId: null,
					title: "API",
					columnId: "column-1",
					priority: null,
					storyPoints: null,
					rank: "U",
					backlogRank: "U",
					assigneeId: null,
					description: null,
					acceptanceCriteria: null,
					tag: null,
					createdAt: null,
					updatedAt: null,
					prerequisiteTaskIds: [],
				},
			],
		);

		expect(graph.edges).toEqual([
			{ from: "task-1", to: "b", label: "API → Build UI" },
		]);
	});
});
