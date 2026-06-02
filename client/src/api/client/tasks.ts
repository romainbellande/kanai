import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";

import type { TaskCreate, TaskUpdate } from "#/api/openapi-client";

import { getAccessToken, getApiBaseUrl } from "./utils";

export type Task = {
	id: string;
	projectId: string;
	title: string;
	status: string;
	columnId?: string;
	priority: string;
	rank: string;
	assigneeId: string | null;
	description: string | null;
	acceptanceCriteria: string | null;
	tag: string | null;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export type CreateTaskInput = TaskCreate & { columnId?: string };
export type UpdateTaskInput = TaskUpdate & { columnId?: string | null };

type TaskJson = {
	id: string;
	project_id: string;
	title: string;
	status?: string;
	column_id?: string;
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
		status: task.status ?? task.column_id ?? "",
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
		status: values.status,
		column_id: values.columnId,
		priority: values.priority,
		rank: values.rank,
		assignee_id: values.assigneeId,
		description: values.description,
		acceptance_criteria: values.acceptanceCriteria,
		tag: values.tag,
	};
}

async function requestProjectTasks<T>(
	path: string,
	init: RequestInit = {},
): Promise<T> {
	const token = await getAccessToken();
	const headers = new Headers(init.headers);

	headers.set("Authorization", `Bearer ${token}`);
	if (init.body !== undefined) {
		headers.set("Content-Type", "application/json");
	}

	const response = await fetch(`${getApiBaseUrl()}${path}`, {
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
