import type {
	ProjectTaskDraft,
	ProjectTaskPrerequisiteRef,
	Task,
} from "#/api/client";

export type EditableProjectTaskDraft = ProjectTaskDraft;

export type ProjectBacklogShapingValidation = {
	canSave: boolean;
	errorsByKey: Record<string, string[]>;
};

export type ProjectBacklogGraph = {
	nodes: { id: string; label: string; type: "draft" | "existing" }[];
	edges: { from: string; to: string; label: string }[];
};

export function createEditableProjectTaskDrafts(
	drafts: ProjectTaskDraft[],
): EditableProjectTaskDraft[] {
	return drafts.map((draft) => ({ ...draft }));
}

export function areProjectTaskDraftsStale({
	generatedFrom,
	sharedUnderstanding,
}: {
	generatedFrom: string | null;
	sharedUnderstanding: string;
}): boolean {
	return generatedFrom !== null && generatedFrom !== sharedUnderstanding;
}

export function validateProjectTaskDrafts(
	drafts: EditableProjectTaskDraft[],
): ProjectBacklogShapingValidation {
	const errorsByKey: Record<string, string[]> = {};
	const keys = new Set(drafts.map((draft) => draft.key));
	const edgeKeys = new Set<string>();

	for (const draft of drafts) {
		const errors: string[] = [];
		if (!draft.title.trim()) {
			errors.push("Title is required.");
		}
		for (const prerequisite of draft.prerequisites) {
			const edgeKey = prerequisiteKey(prerequisite);
			const pairKey = `${draft.key}->${edgeKey}`;
			if (edgeKeys.has(pairKey)) {
				errors.push("Duplicate prerequisite.");
			}
			edgeKeys.add(pairKey);
			if (prerequisite.type !== "draft") {
				continue;
			}
			if (prerequisite.key === draft.key) {
				errors.push("Task cannot depend on itself.");
			} else if (!keys.has(prerequisite.key)) {
				errors.push("Missing draft prerequisite.");
			}
		}
		if (errors.length > 0) {
			errorsByKey[draft.key] = errors;
		}
	}

	for (const key of draftCycleKeys(drafts)) {
		errorsByKey[key] = [
			...(errorsByKey[key] ?? []),
			"Draft prerequisites contain a cycle.",
		];
	}

	return { canSave: Object.keys(errorsByKey).length === 0, errorsByKey };
}

export function getProjectBacklogGraph(
	drafts: EditableProjectTaskDraft[],
	existingTasks: Task[],
): ProjectBacklogGraph {
	const existingById = new Map(existingTasks.map((task) => [task.id, task]));
	const nodes = [
		...drafts.map((draft) => ({
			id: draft.key,
			label: draft.title || draft.key,
			type: "draft" as const,
		})),
		...existingTasks.map((task) => ({
			id: task.id,
			label: task.title,
			type: "existing" as const,
		})),
	];
	const edges = drafts.flatMap((draft) =>
		draft.prerequisites.map((prerequisite) => {
			const from =
				prerequisite.type === "draft" ? prerequisite.key : prerequisite.taskId;
			const label =
				prerequisite.type === "draft"
					? from
					: (existingById.get(from)?.title ?? from);
			return {
				from,
				to: draft.key,
				label: `${label} → ${draft.title || draft.key}`,
			};
		}),
	);
	return { nodes, edges };
}

function prerequisiteKey(prerequisite: ProjectTaskPrerequisiteRef): string {
	return prerequisite.type === "draft"
		? `draft:${prerequisite.key}`
		: `existing:${prerequisite.taskId}`;
}

function draftCycleKeys(drafts: EditableProjectTaskDraft[]): Set<string> {
	const draftByKey = new Map(drafts.map((draft) => [draft.key, draft]));
	const cycleKeys = new Set<string>();
	const visiting = new Set<string>();
	const visited = new Set<string>();

	function visit(key: string, path: string[]) {
		if (visiting.has(key)) {
			for (const cycleKey of path.slice(path.indexOf(key))) {
				cycleKeys.add(cycleKey);
			}
			return;
		}
		if (visited.has(key)) {
			return;
		}
		visiting.add(key);
		for (const prerequisite of draftByKey.get(key)?.prerequisites ?? []) {
			if (prerequisite.type === "draft" && draftByKey.has(prerequisite.key)) {
				visit(prerequisite.key, [...path, prerequisite.key]);
			}
		}
		visiting.delete(key);
		visited.add(key);
	}

	for (const draft of drafts) {
		visit(draft.key, [draft.key]);
	}
	return cycleKeys;
}
