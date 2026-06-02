import { useQueryClient } from "@tanstack/react-query";

import { currentUserQueryOptions } from "./current-user";
import {
	type CreateProjectInput,
	createProject,
	projectQueryOptions,
	projectsQueryKey,
	projectsQueryOptions,
} from "./projects";
import {
	type CreateTaskInput,
	createProjectTask,
	projectTasksQueryKey,
	projectTasksQueryOptions,
	type Task,
	type UpdateTaskInput,
	updateProjectTask,
} from "./tasks";

export function useKanaiApi() {
	const queryClient = useQueryClient();

	return {
		projects: {
			list: () => projectsQueryOptions(),
			get: (projectId: string) => projectQueryOptions(projectId),
			create: async (values: CreateProjectInput) => {
				const project = await createProject(values);
				await queryClient.invalidateQueries({ queryKey: projectsQueryKey });
				return project;
			},
		},
		tasks: {
			list: (projectId: string) => projectTasksQueryOptions(projectId),
			create: async (projectId: string, values: CreateTaskInput) => {
				const task = await createProjectTask({ projectId, taskCreate: values });
				await queryClient.invalidateQueries({
					queryKey: projectTasksQueryKey(projectId),
				});
				return task;
			},
			update: async (
				projectId: string,
				{ taskId, values }: { taskId: string; values: UpdateTaskInput },
			) => {
				const task = await updateProjectTask({
					projectId,
					taskId,
					taskUpdate: values,
				});
				await queryClient.invalidateQueries({
					queryKey: projectTasksQueryKey(projectId),
				});
				return task;
			},
			patchCached: (
				projectId: string,
				taskId: string,
				patch: Partial<Task>,
			) => {
				queryClient.setQueryData<Task[]>(
					projectTasksQueryKey(projectId),
					(tasks) =>
						tasks?.map((task) =>
							task.id === taskId ? { ...task, ...patch } : task,
						),
				);
			},
			invalidateProjectTasks: (projectId: string) =>
				queryClient.invalidateQueries({
					queryKey: projectTasksQueryKey(projectId),
				}),
		},
		currentUser: {
			get: () => currentUserQueryOptions(),
		},
	};
}
