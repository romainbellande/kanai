import { useQueryClient } from "@tanstack/react-query";

import { projectChatMessagesQueryOptions } from "./chat";
import { currentUserQueryOptions } from "./current-user";
import {
	addProjectMember,
	type CreateProjectColumnInput,
	type CreateProjectInput,
	type CreateProjectSprintInput,
	closeActiveProjectSprint,
	createProject,
	createProjectColumn,
	createProjectSprint,
	deleteProjectColumn,
	getActiveProjectSprintCloseConfirmation,
	getProjectDoneColumn,
	type ProjectColumn,
	projectActiveSprintQueryKey,
	projectActiveSprintQueryOptions,
	projectColumnsQueryKey,
	projectColumnsQueryOptions,
	projectDoneColumnQueryKey,
	projectDoneColumnQueryOptions,
	projectQueryOptions,
	projectSprintHistoryQueryKey,
	projectSprintHistoryQueryOptions,
	projectsQueryKey,
	projectsQueryOptions,
	type ReorderProjectColumnsInput,
	reorderProjectColumns,
	type UpdateProjectColumnInput,
	type UpdateProjectDoneColumnInput,
	type UpdateProjectInput,
	type UpdateProjectSprintInput,
	updateActiveProjectSprint,
	updateProject,
	updateProjectColumn,
	updateProjectDoneColumn,
} from "./projects";
import {
	addProjectBacklogTaskToActiveSprint,
	type BulkCreateProjectBacklogTasksInput,
	bulkCreateProjectBacklogTasks,
	type CreateProjectTaskInput,
	type CreateTaskInput,
	createProjectBacklogTask,
	createProjectTask,
	listProjectActiveSprintTasks,
	listProjectBacklog,
	type MoveTaskInput,
	moveProjectTask,
	projectActiveSprintTasksQueryKey,
	projectActiveSprintTasksQueryOptions,
	projectBacklogQueryKey,
	projectBacklogQueryOptions,
	projectTasksQueryKey,
	projectTasksQueryOptions,
	type ReorderProjectBacklogInput,
	removeProjectActiveSprintTaskToBacklog,
	reorderProjectBacklog,
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
			update: async (projectId: string, values: UpdateProjectInput) => {
				const project = await updateProject(projectId, values);
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
				await queryClient.invalidateQueries({
					queryKey: projectDoneColumnQueryKey(projectId),
				});
			},
			replaceCached: (
				projectId: string,
				columns: ProjectColumn[] | undefined,
			) => {
				queryClient.setQueryData(projectColumnsQueryKey(projectId), columns);
			},
			invalidateProjectColumns: (projectId: string) =>
				queryClient.invalidateQueries({
					queryKey: projectColumnsQueryKey(projectId),
				}),
		},
		sprints: {
			active: (projectId: string) => projectActiveSprintQueryOptions(projectId),
			history: (projectId: string) =>
				projectSprintHistoryQueryOptions(projectId),
			create: async (projectId: string, values: CreateProjectSprintInput) => {
				const sprint = await createProjectSprint(projectId, values);
				queryClient.setQueryData(
					projectActiveSprintQueryKey(projectId),
					sprint,
				);
				return sprint;
			},
			updateActive: async (
				projectId: string,
				values: UpdateProjectSprintInput,
			) => {
				const sprint = await updateActiveProjectSprint(projectId, values);
				queryClient.setQueryData(
					projectActiveSprintQueryKey(projectId),
					sprint,
				);
				return sprint;
			},
			closeConfirmation: (projectId: string) =>
				getActiveProjectSprintCloseConfirmation(projectId),
			closeActive: async (projectId: string) => {
				const result = await closeActiveProjectSprint(projectId);
				queryClient.setQueryData(projectActiveSprintQueryKey(projectId), null);
				await queryClient.invalidateQueries({
					queryKey: projectTasksQueryKey(projectId),
				});
				await queryClient.invalidateQueries({
					queryKey: projectActiveSprintTasksQueryKey(projectId),
				});
				await queryClient.invalidateQueries({
					queryKey: projectBacklogQueryKey(projectId),
				});
				await queryClient.invalidateQueries({
					queryKey: projectSprintHistoryQueryKey(projectId),
				});
				return result;
			},
			invalidateActiveSprint: (projectId: string) =>
				queryClient.invalidateQueries({
					queryKey: projectActiveSprintQueryKey(projectId),
				}),
		},
		doneColumn: {
			get: (projectId: string) => projectDoneColumnQueryOptions(projectId),
			read: (projectId: string) => getProjectDoneColumn(projectId),
			update: async (
				projectId: string,
				values: UpdateProjectDoneColumnInput,
			) => {
				const doneColumn = await updateProjectDoneColumn(projectId, values);
				queryClient.setQueryData(
					projectDoneColumnQueryKey(projectId),
					doneColumn,
				);
				await queryClient.invalidateQueries({
					queryKey: projectColumnsQueryKey(projectId),
				});
				return doneColumn;
			},
		},
		tasks: {
			list: (projectId: string) => projectTasksQueryOptions(projectId),
			listActiveSprint: (projectId: string) =>
				projectActiveSprintTasksQueryOptions(projectId),
			fetchActiveSprint: (projectId: string) =>
				listProjectActiveSprintTasks(projectId),
			create: async (projectId: string, values: CreateProjectTaskInput) => {
				const task = await createProjectTask({ projectId, taskCreate: values });
				await queryClient.invalidateQueries({
					queryKey: projectTasksQueryKey(projectId),
				});
				await queryClient.invalidateQueries({
					queryKey: projectActiveSprintTasksQueryKey(projectId),
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
				await queryClient.invalidateQueries({
					queryKey: projectActiveSprintTasksQueryKey(projectId),
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
				await queryClient.invalidateQueries({
					queryKey: projectActiveSprintTasksQueryKey(projectId),
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
			invalidateActiveSprintTasks: (projectId: string) =>
				queryClient.invalidateQueries({
					queryKey: projectActiveSprintTasksQueryKey(projectId),
				}),
		},
		backlog: {
			list: (projectId: string) => projectBacklogQueryOptions(projectId),
			fetch: (projectId: string) => listProjectBacklog(projectId),
			bulkCreateTasks: async (
				projectId: string,
				values: BulkCreateProjectBacklogTasksInput,
			) => {
				const tasks = await bulkCreateProjectBacklogTasks(projectId, values);
				await queryClient.invalidateQueries({
					queryKey: projectBacklogQueryKey(projectId),
				});
				await queryClient.invalidateQueries({
					queryKey: projectTasksQueryKey(projectId),
				});
				return tasks;
			},
			createTask: async (projectId: string, values: CreateTaskInput) => {
				const task = await createProjectBacklogTask({
					projectId,
					taskCreate: values,
				});
				await queryClient.invalidateQueries({
					queryKey: projectBacklogQueryKey(projectId),
				});
				await queryClient.invalidateQueries({
					queryKey: projectTasksQueryKey(projectId),
				});
				return task;
			},
			reorder: async (
				projectId: string,
				values: ReorderProjectBacklogInput,
			) => {
				const tasks = await reorderProjectBacklog(projectId, values);
				queryClient.setQueryData(projectBacklogQueryKey(projectId), tasks);
				await queryClient.invalidateQueries({
					queryKey: projectTasksQueryKey(projectId),
				});
				return tasks;
			},
			addToActiveSprint: async (projectId: string, taskId: string) => {
				const task = await addProjectBacklogTaskToActiveSprint(projectId, {
					taskId,
				});
				await queryClient.invalidateQueries({
					queryKey: projectBacklogQueryKey(projectId),
				});
				await queryClient.invalidateQueries({
					queryKey: projectTasksQueryKey(projectId),
				});
				await queryClient.invalidateQueries({
					queryKey: projectActiveSprintTasksQueryKey(projectId),
				});
				return task;
			},
			removeFromActiveSprint: async (projectId: string, taskId: string) => {
				const task = await removeProjectActiveSprintTaskToBacklog(
					projectId,
					taskId,
				);
				await queryClient.invalidateQueries({
					queryKey: projectActiveSprintTasksQueryKey(projectId),
				});
				await queryClient.invalidateQueries({
					queryKey: projectBacklogQueryKey(projectId),
				});
				await queryClient.invalidateQueries({
					queryKey: projectTasksQueryKey(projectId),
				});
				return task;
			},
		},
		currentUser: {
			get: () => currentUserQueryOptions(),
		},
		chat: {
			messages: (projectId: string, enabled = true) =>
				projectChatMessagesQueryOptions(projectId, enabled),
		},
		users: {
			projectAccess: (projectId: string, userIds: string[], enabled = true) =>
				projectAccessUsersQueryOptions(projectId, userIds, enabled),
			search: (query: string, limit = 20, enabled = true) =>
				userSearchQueryOptions(query, limit, enabled),
		},
	};
}
