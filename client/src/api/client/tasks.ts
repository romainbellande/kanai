import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";

import {
	type TaskCreate,
	type TaskRead,
	TasksApi,
	type TaskUpdate,
} from "#/api/openapi-client";

import { createAuthenticatedConfiguration } from "./utils";

export type Task = TaskRead;
export type CreateTaskInput = TaskCreate;
export type UpdateTaskInput = TaskUpdate;

export function projectTasksQueryKey(projectId: string) {
	return ["projects", projectId, "tasks"] as const;
}

function createTasksApi(): TasksApi {
	return new TasksApi(createAuthenticatedConfiguration());
}

export async function listProjectTasks(projectId: string): Promise<Task[]> {
	return createTasksApi().listTasksEndpointProjectsProjectIdTasksGet({
		projectId,
	});
}

export async function createProjectTask({
	projectId,
	taskCreate,
}: {
	projectId: string;
	taskCreate: CreateTaskInput;
}): Promise<Task> {
	return createTasksApi().createTaskEndpointProjectsProjectIdTasksPost({
		projectId,
		taskCreate,
	});
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
	return createTasksApi().updateTaskEndpointProjectsProjectIdTasksTaskIdPatch({
		projectId,
		taskId,
		taskUpdate,
	});
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
