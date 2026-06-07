import { useQueryClient } from "@tanstack/react-query";

import { currentUserQueryOptions } from "./current-user";
import {
	addProjectMember,
	type CreateProjectColumnInput,
	type CreateProjectInput,
	createProject,
	createProjectColumn,
	deleteProjectColumn,
	projectColumnsQueryKey,
	projectColumnsQueryOptions,
	projectQueryOptions,
	projectsQueryKey,
	projectsQueryOptions,
	type ReorderProjectColumnsInput,
	reorderProjectColumns,
	type UpdateProjectColumnInput,
	updateProjectColumn,
} from "./projects";
import {
	type CreateTaskInput,
	createProjectTask,
	type MoveTaskInput,
	moveProjectTask,
	projectTasksQueryKey,
	projectTasksQueryOptions,
	type Task,
	type UpdateTaskInput,
	updateProjectTask,
} from "./tasks";
import {
	projectAccessUsersQueryOptions,
	userSearchQueryOptions,
} from "./users";

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
			addMember: async (projectId: string, userId: string) => {
				const project = await addProjectMember(projectId, userId);
				queryClient.setQueryData(
					projectQueryOptions(projectId).queryKey,
					project,
				);
				await queryClient.invalidateQueries({
					exact: true,
					queryKey: projectsQueryKey,
				});
				return project;
			},
		},
		projectColumns: {
			list: (projectId: string) => projectColumnsQueryOptions(projectId),
			create: async (projectId: string, values: CreateProjectColumnInput) => {
				const column = await createProjectColumn(projectId, values);
				await queryClient.invalidateQueries({
					queryKey: projectColumnsQueryKey(projectId),
				});
				return column;
			},
			update: async (
				projectId: string,
				columnId: string,
				values: UpdateProjectColumnInput,
			) => {
				const column = await updateProjectColumn(projectId, columnId, values);
				await queryClient.invalidateQueries({
					queryKey: projectColumnsQueryKey(projectId),
				});
				return column;
			},
			reorder: async (
				projectId: string,
				values: ReorderProjectColumnsInput,
			) => {
				const columns = await reorderProjectColumns(projectId, values);
				await queryClient.invalidateQueries({
					queryKey: projectColumnsQueryKey(projectId),
				});
				return columns;
			},
			delete: async (projectId: string, columnId: string) => {
				await deleteProjectColumn(projectId, columnId);
				await queryClient.invalidateQueries({
					queryKey: projectColumnsQueryKey(projectId),
				});
			},
			invalidateProjectColumns: (projectId: string) =>
				queryClient.invalidateQueries({
					queryKey: projectColumnsQueryKey(projectId),
				}),
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
			move: async (
				projectId: string,
				{ taskId, destination }: { taskId: string; destination: MoveTaskInput },
			) => {
				const task = await moveProjectTask({
					projectId,
					taskId,
					destination,
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
				const previousTasks = queryClient.getQueryData<Task[]>(
					projectTasksQueryKey(projectId),
				);
				queryClient.setQueryData<Task[]>(
					projectTasksQueryKey(projectId),
					(tasks) =>
						tasks?.map((task) =>
							task.id === taskId ? { ...task, ...patch } : task,
						),
				);

				return previousTasks;
			},
			replaceCached: (projectId: string, tasks: Task[] | undefined) => {
				queryClient.setQueryData(projectTasksQueryKey(projectId), tasks);
			},
			invalidateProjectTasks: (projectId: string) =>
				queryClient.invalidateQueries({
					queryKey: projectTasksQueryKey(projectId),
				}),
		},
		currentUser: {
			get: () => currentUserQueryOptions(),
		},
		users: {
			projectAccess: (projectId: string, userIds: string[], enabled = true) =>
				projectAccessUsersQueryOptions(projectId, userIds, enabled),
			search: (query: string, limit = 20, enabled = true) =>
				userSearchQueryOptions(query, limit, enabled),
		},
	};
}
