import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";

import type {
	TaskCreate,
	TaskDestination,
	TaskUpdate,
} from "#/api/openapi-client";

import { fetchAuthenticatedApi } from "./utils";

export type Task = {
	id: string;
	projectId: string;
	sprintId: string | null;
	title: string;
	columnId: string;
	priority: string | null;
	storyPoints: number | null;
	rank: string;
	backlogRank: string | null;
	assigneeId: string | null;
	description: string | null;
	acceptanceCriteria: string | null;
	tag: string | null;
	createdAt: Date | null;
	updatedAt: Date | null;
	prerequisiteTaskIds?: string[];
};

export type TaskPrerequisiteInput =
	| { type: "draft"; key: string }
	| { type: "existing"; taskId: string };

export type BacklogTaskDraftInput = {
	key: string;
	title: string;
	priority?: string | null;
	storyPoints?: number | null;
	assigneeId?: string | null;
	description?: string | null;
	acceptanceCriteria?: string | null;
	tag?: string | null;
	prerequisites?: TaskPrerequisiteInput[];
};

export type BulkCreateProjectBacklogTasksInput = {
	tasks: BacklogTaskDraftInput[];
};

export type CreateTaskInput = TaskCreate;
export type CreateProjectTaskInput = CreateTaskInput & {
	includeInActiveSprint?: boolean;
};
export type ReorderProjectBacklogInput = {
	taskIds: string[];
};
export type AddProjectSprintTaskInput = {
	taskId: string;
};
export type UpdateTaskInput = TaskUpdate;
export type MoveTaskInput = TaskDestination;

type TaskJson = {
	id: string;
	project_id: string;
	sprint_id?: string | null;
	title: string;
	column_id: string;
	priority: string | null;
	story_points?: number | null;
	rank: string;
	backlog_rank?: string | null;
	assignee_id: string | null;
	description: string | null;
	acceptance_criteria: string | null;
	tag: string | null;
	created_at: string | null;
	updated_at: string | null;
	prerequisite_task_ids?: string[];
};

export function projectTasksQueryKey(projectId: string) {
	return ["projects", projectId, "tasks"] as const;
}

export function projectActiveSprintTasksQueryKey(projectId: string) {
	return ["projects", projectId, "tasks", "active-sprint"] as const;
}

export function projectBacklogQueryKey(projectId: string) {
	return ["projects", projectId, "backlog"] as const;
}

function mapTask(task: TaskJson): Task {
	return {
		id: task.id,
		projectId: task.project_id,
		sprintId: task.sprint_id ?? null,
		title: task.title,
		columnId: task.column_id,
		priority: normalizeTaskPriority(task.priority),
		storyPoints: task.story_points ?? null,
		rank: task.rank,
		backlogRank: task.backlog_rank ?? null,
		assigneeId: task.assignee_id,
		description: task.description,
		acceptanceCriteria: task.acceptance_criteria,
		tag: task.tag,
		createdAt: task.created_at === null ? null : new Date(task.created_at),
		updatedAt: task.updated_at === null ? null : new Date(task.updated_at),
		prerequisiteTaskIds: task.prerequisite_task_ids ?? [],
	};
}

function normalizeTaskPriority(
	priority: string | null | undefined,
): string | null {
	const normalizedPriority = priority?.trim().toLowerCase() ?? "";
	if (!normalizedPriority) {
		return null;
	}
	return normalizedPriority === "urgent" ? "critical" : normalizedPriority;
}

function taskInputToJson(values: CreateProjectTaskInput | UpdateTaskInput) {
	return {
		title: values.title,
		column_id: values.columnId,
		include_in_active_sprint:
			"includeInActiveSprint" in values
				? values.includeInActiveSprint
				: undefined,
		priority: values.priority,
		story_points: values.storyPoints,
		assignee_id: values.assigneeId,
		description: values.description,
		acceptance_criteria: values.acceptanceCriteria,
		tag: values.tag,
	};
}

function taskDestinationToJson(values: MoveTaskInput) {
	return {
		column_id: values.columnId,
		before_task_id: values.beforeTaskId,
		after_task_id: values.afterTaskId,
	};
}

function backlogTaskDraftToJson(values: BacklogTaskDraftInput) {
	return {
		key: values.key,
		title: values.title,
		priority: values.priority,
		story_points: values.storyPoints,
		assignee_id: values.assigneeId,
		description: values.description,
		acceptance_criteria: values.acceptanceCriteria,
		tag: values.tag,
		prerequisites: (values.prerequisites ?? []).map((prerequisite) =>
			prerequisite.type === "draft"
				? { type: "draft", key: prerequisite.key }
				: { type: "existing", task_id: prerequisite.taskId },
		),
	};
}

async function requestProjectTasks<T>(
	path: string,
	init: RequestInit = {},
): Promise<T> {
	const headers = new Headers(init.headers);

	if (init.body !== undefined) {
		headers.set("Content-Type", "application/json");
	}

	const response = await fetchAuthenticatedApi(path, {
		...init,
		headers,
	});

	if (!response.ok) {
		throw new Error(`Project task request failed with ${response.status}.`);
	}

	return response.json() as Promise<T>;
}

export async function listProjectTasks(projectId: string): Promise<Task[]> {
	const tasks = await requestProjectTasks<TaskJson[]>(
		`/projects/${projectId}/tasks`,
		{ method: "GET" },
	);

	return tasks.map(mapTask);
}

export async function listProjectActiveSprintTasks(
	projectId: string,
): Promise<Task[]> {
	const tasks = await requestProjectTasks<TaskJson[]>(
		`/projects/${projectId}/tasks/active-sprint`,
		{ method: "GET" },
	);

	return tasks.map(mapTask);
}

export async function listProjectBacklog(projectId: string): Promise<Task[]> {
	const tasks = await requestProjectTasks<TaskJson[]>(
		`/projects/${projectId}/backlog`,
		{ method: "GET" },
	);

	return tasks.map(mapTask);
}

export async function createProjectTask({
	projectId,
	taskCreate,
}: {
	projectId: string;
	taskCreate: CreateProjectTaskInput;
}): Promise<Task> {
	const task = await requestProjectTasks<TaskJson>(
		`/projects/${projectId}/tasks`,
		{
			method: "POST",
			body: JSON.stringify(taskInputToJson(taskCreate)),
		},
	);

	return mapTask(task);
}

export async function createProjectBacklogTask({
	projectId,
	taskCreate,
}: {
	projectId: string;
	taskCreate: CreateTaskInput;
}): Promise<Task> {
	const task = await requestProjectTasks<TaskJson>(
		`/projects/${projectId}/backlog/tasks`,
		{
			method: "POST",
			body: JSON.stringify(taskInputToJson(taskCreate)),
		},
	);

	return mapTask(task);
}

export async function bulkCreateProjectBacklogTasks(
	projectId: string,
	values: BulkCreateProjectBacklogTasksInput,
): Promise<Task[]> {
	const tasks = await requestProjectTasks<TaskJson[]>(
		`/projects/${projectId}/backlog/tasks/bulk`,
		{
			method: "POST",
			body: JSON.stringify({
				tasks: values.tasks.map(backlogTaskDraftToJson),
			}),
		},
	);

	return tasks.map(mapTask);
}

export async function reorderProjectBacklog(
	projectId: string,
	values: ReorderProjectBacklogInput,
): Promise<Task[]> {
	const tasks = await requestProjectTasks<TaskJson[]>(
		`/projects/${projectId}/backlog/reorder`,
		{
			method: "PUT",
			body: JSON.stringify({ task_ids: values.taskIds }),
		},
	);

	return tasks.map(mapTask);
}

export async function addProjectBacklogTaskToActiveSprint(
	projectId: string,
	values: AddProjectSprintTaskInput,
): Promise<Task> {
	const task = await requestProjectTasks<TaskJson>(
		`/projects/${projectId}/sprints/active/tasks`,
		{
			method: "POST",
			body: JSON.stringify({ task_id: values.taskId }),
		},
	);

	return mapTask(task);
}

export async function removeProjectActiveSprintTaskToBacklog(
	projectId: string,
	taskId: string,
): Promise<Task> {
	const task = await requestProjectTasks<TaskJson>(
		`/projects/${projectId}/sprints/active/tasks/${taskId}`,
		{ method: "DELETE" },
	);

	return mapTask(task);
}

export async function updateProjectTask({
	projectId,
	taskId,
	taskUpdate,
}: {
	projectId: string;
	taskId: string;
	taskUpdate: UpdateTaskInput;
}): Promise<Task> {
	const task = await requestProjectTasks<TaskJson>(
		`/projects/${projectId}/tasks/${taskId}`,
		{
			method: "PATCH",
			body: JSON.stringify(taskInputToJson(taskUpdate)),
		},
	);

	return mapTask(task);
}

export async function moveProjectTask({
	projectId,
	taskId,
	destination,
}: {
	projectId: string;
	taskId: string;
	destination: MoveTaskInput;
}): Promise<Task> {
	const task = await requestProjectTasks<TaskJson>(
		`/projects/${projectId}/tasks/${taskId}/move`,
		{
			method: "PUT",
			body: JSON.stringify(taskDestinationToJson(destination)),
		},
	);

	return mapTask(task);
}

export function projectTasksQueryOptions(projectId: string) {
	return queryOptions({
		queryKey: projectTasksQueryKey(projectId),
		queryFn: () => listProjectTasks(projectId),
	});
}

export function projectActiveSprintTasksQueryOptions(projectId: string) {
	return queryOptions({
		queryKey: projectActiveSprintTasksQueryKey(projectId),
		queryFn: () => listProjectActiveSprintTasks(projectId),
	});
}

export function projectBacklogQueryOptions(projectId: string) {
	return queryOptions({
		queryKey: projectBacklogQueryKey(projectId),
		queryFn: () => listProjectBacklog(projectId),
	});
}

export function useProjectTasksQuery(projectId: string) {
	return useQuery(projectTasksQueryOptions(projectId));
}

export function useCreateProjectTaskMutation() {
	return useMutation({ mutationFn: createProjectTask });
}

export function useUpdateProjectTaskMutation() {
	return useMutation({ mutationFn: updateProjectTask });
}

export function useMoveProjectTaskMutation() {
	return useMutation({ mutationFn: moveProjectTask });
}
