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
	title: string;
	columnId: string;
	priority: string;
	rank: string;
	assigneeId: string | null;
	description: string | null;
	acceptanceCriteria: string | null;
	tag: string | null;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export type CreateTaskInput = TaskCreate;
export type UpdateTaskInput = TaskUpdate;
export type MoveTaskInput = TaskDestination;

type TaskJson = {
	id: string;
	project_id: string;
	title: string;
	column_id: string;
	priority: string;
	rank: string;
	assignee_id: string | null;
	description: string | null;
	acceptance_criteria: string | null;
	tag: string | null;
	created_at: string | null;
	updated_at: string | null;
};

export function projectTasksQueryKey(projectId: string) {
	return ["projects", projectId, "tasks"] as const;
}

function mapTask(task: TaskJson): Task {
	return {
		id: task.id,
		projectId: task.project_id,
		title: task.title,
		columnId: task.column_id,
		priority: task.priority,
		rank: task.rank,
		assigneeId: task.assignee_id,
		description: task.description,
		acceptanceCriteria: task.acceptance_criteria,
		tag: task.tag,
		createdAt: task.created_at === null ? null : new Date(task.created_at),
		updatedAt: task.updated_at === null ? null : new Date(task.updated_at),
	};
}

function taskInputToJson(values: CreateTaskInput | UpdateTaskInput) {
	return {
		title: values.title,
		column_id: values.columnId,
		priority: values.priority,
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

export async function createProjectTask({
	projectId,
	taskCreate,
}: {
	projectId: string;
	taskCreate: CreateTaskInput;
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
