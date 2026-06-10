import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";

import {
	type ProjectCreate,
	type ProjectRead,
	ProjectsApi,
	type ProjectUpdate,
} from "#/api/openapi-client";
import type { Task } from "./tasks";
import {
	createAuthenticatedConfiguration,
	fetchAuthenticatedApi,
} from "./utils";

export type Project = ProjectRead;
export type CreateProjectInput = ProjectCreate;
export type UpdateProjectInput = ProjectUpdate;

export type ProjectColumn = {
	id: string;
	projectId: string;
	name: string;
	description: string | null;
	position: number;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export type CreateProjectColumnInput = {
	name: string;
	description?: string | null;
};

export type UpdateProjectColumnInput = {
	name: string;
	description?: string | null;
};

export type ReorderProjectColumnsInput = {
	columnIds: string[];
};

export type ProjectSprint = {
	id: string;
	projectId: string;
	name: string;
	lifecycleState: "active" | "closed";
	plannedStartDate: string;
	plannedEndDate: string;
	goal: string | null;
	closedAt: Date | null;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export type ProjectSprintTaskSnapshot = {
	id: string;
	sprintId: string;
	taskId: string | null;
	columnId: string;
	title: string;
	outcome: "finished" | "unfinished";
	priority: string | null;
	rank: string;
	description: string | null;
	acceptanceCriteria: string | null;
	tag: string | null;
	liveTaskExists: boolean;
	createdAt: Date | null;
};

export type ProjectSprintClosePreview = {
	sprint: ProjectSprint;
	finishedCount: number;
	unfinishedCount: number;
	unfinishedTasks: Task[];
	carryoverStatement: string;
};

export type ProjectSprintCloseResult = ProjectSprintClosePreview & {
	snapshots: ProjectSprintTaskSnapshot[];
};

export type CreateProjectSprintInput = {
	plannedStartDate: string;
	plannedEndDate: string;
	goal?: string | null;
	taskIds?: string[];
};

export type UpdateProjectSprintInput = {
	plannedStartDate?: string;
	plannedEndDate?: string;
	goal?: string | null;
};

export type ProjectDoneColumn = {
	projectId: string;
	doneColumnId: string | null;
	requiresDesignation: boolean;
};

export type UpdateProjectDoneColumnInput = {
	doneColumnId: string;
};

export class ProjectColumnRequestError extends Error {
	readonly status: number;
	readonly detail: string | null;

	constructor(status: number, detail: string | null) {
		super(detail ?? `Project column request failed with ${status}.`);
		this.name = "ProjectColumnRequestError";
		this.status = status;
		this.detail = detail;
	}
}

type ProjectColumnJson = {
	id: string;
	project_id: string;
	name: string;
	description: string | null;
	position: number;
	created_at: string | null;
	updated_at: string | null;
};

type ProjectSprintJson = {
	id: string;
	project_id: string;
	name: string;
	lifecycle_state: "active" | "closed";
	planned_start_date: string;
	planned_end_date: string;
	goal: string | null;
	closed_at?: string | null;
	created_at: string | null;
	updated_at: string | null;
};

type ProjectSprintTaskSnapshotJson = {
	id: string;
	sprint_id: string;
	task_id: string | null;
	column_id: string;
	title: string;
	outcome: "finished" | "unfinished";
	priority: string | null;
	rank: string;
	description: string | null;
	acceptance_criteria: string | null;
	tag: string | null;
	live_task_exists?: boolean;
	created_at: string | null;
};

type ProjectSprintClosePreviewJson = {
	sprint: ProjectSprintJson;
	finished_count: number;
	unfinished_count: number;
	unfinished_tasks: TaskJson[];
	carryover_statement: string;
};

type ProjectSprintCloseResultJson = ProjectSprintClosePreviewJson & {
	snapshots: ProjectSprintTaskSnapshotJson[];
};

type TaskJson = {
	id: string;
	project_id: string;
	sprint_id?: string | null;
	title: string;
	column_id: string;
	priority: string | null;
	rank: string;
	backlog_rank?: string | null;
	assignee_id: string | null;
	description: string | null;
	acceptance_criteria: string | null;
	tag: string | null;
	created_at: string | null;
	updated_at: string | null;
};

type ProjectDoneColumnJson = {
	project_id: string;
	done_column_id: string | null;
	requires_designation: boolean;
};

export const projectsQueryKey = ["projects"] as const;

export function projectQueryKey(projectId: string) {
	return [...projectsQueryKey, projectId] as const;
}

export function projectColumnsQueryKey(projectId: string) {
	return [...projectQueryKey(projectId), "columns"] as const;
}

export function projectActiveSprintQueryKey(projectId: string) {
	return [...projectQueryKey(projectId), "sprints", "active"] as const;
}

export function projectSprintHistoryQueryKey(projectId: string) {
	return [...projectQueryKey(projectId), "sprints", "history"] as const;
}

export function projectDoneColumnQueryKey(projectId: string) {
	return [...projectQueryKey(projectId), "done-column"] as const;
}

function createProjectsApi(): ProjectsApi {
	return new ProjectsApi(createAuthenticatedConfiguration());
}

export async function listProjects(): Promise<Project[]> {
	return createProjectsApi().listProjectsProjectsGet();
}

export async function getProject(projectId: string): Promise<Project> {
	return createProjectsApi().getProjectProjectsProjectIdGet({ projectId });
}

export async function createProject(
	projectCreate: CreateProjectInput,
): Promise<Project> {
	return createProjectsApi().createProjectEndpointProjectsPost({
		projectCreate,
	});
}

export async function updateProject(
	projectId: string,
	projectUpdate: UpdateProjectInput,
): Promise<Project> {
	return createProjectsApi().updateProjectProjectsProjectIdPatch({
		projectId,
		projectUpdate,
	});
}

export async function addProjectMember(
	projectId: string,
	userId: string,
): Promise<Project> {
	return createProjectsApi().addProjectMemberProjectsProjectIdMembersPost({
		projectId,
		projectMemberCreate: { userId },
	});
}

function mapProjectColumn(column: ProjectColumnJson): ProjectColumn {
	return {
		id: column.id,
		projectId: column.project_id,
		name: column.name,
		description: column.description,
		position: column.position,
		createdAt: column.created_at === null ? null : new Date(column.created_at),
		updatedAt: column.updated_at === null ? null : new Date(column.updated_at),
	};
}

function mapProjectSprint(sprint: ProjectSprintJson): ProjectSprint {
	return {
		id: sprint.id,
		projectId: sprint.project_id,
		name: sprint.name,
		lifecycleState: sprint.lifecycle_state,
		plannedStartDate: sprint.planned_start_date,
		plannedEndDate: sprint.planned_end_date,
		goal: sprint.goal,
		closedAt: sprint.closed_at ? new Date(sprint.closed_at) : null,
		createdAt: sprint.created_at === null ? null : new Date(sprint.created_at),
		updatedAt: sprint.updated_at === null ? null : new Date(sprint.updated_at),
	};
}

function mapTask(task: TaskJson): Task {
	return {
		id: task.id,
		projectId: task.project_id,
		sprintId: task.sprint_id ?? null,
		title: task.title,
		columnId: task.column_id,
		priority: task.priority,
		rank: task.rank,
		backlogRank: task.backlog_rank ?? null,
		assigneeId: task.assignee_id,
		description: task.description,
		acceptanceCriteria: task.acceptance_criteria,
		tag: task.tag,
		createdAt: task.created_at === null ? null : new Date(task.created_at),
		updatedAt: task.updated_at === null ? null : new Date(task.updated_at),
	};
}

function mapProjectSprintTaskSnapshot(
	snapshot: ProjectSprintTaskSnapshotJson,
): ProjectSprintTaskSnapshot {
	return {
		id: snapshot.id,
		sprintId: snapshot.sprint_id,
		taskId: snapshot.task_id,
		columnId: snapshot.column_id,
		title: snapshot.title,
		outcome: snapshot.outcome,
		priority: snapshot.priority,
		rank: snapshot.rank,
		description: snapshot.description,
		acceptanceCriteria: snapshot.acceptance_criteria,
		tag: snapshot.tag,
		liveTaskExists: snapshot.live_task_exists ?? false,
		createdAt:
			snapshot.created_at === null ? null : new Date(snapshot.created_at),
	};
}

function mapProjectSprintClosePreview(
	preview: ProjectSprintClosePreviewJson,
): ProjectSprintClosePreview {
	return {
		sprint: mapProjectSprint(preview.sprint),
		finishedCount: preview.finished_count,
		unfinishedCount: preview.unfinished_count,
		unfinishedTasks: preview.unfinished_tasks.map(mapTask),
		carryoverStatement: preview.carryover_statement,
	};
}

function mapProjectSprintCloseResult(
	result: ProjectSprintCloseResultJson,
): ProjectSprintCloseResult {
	return {
		...mapProjectSprintClosePreview(result),
		snapshots: result.snapshots.map(mapProjectSprintTaskSnapshot),
	};
}

function mapProjectDoneColumn(
	doneColumn: ProjectDoneColumnJson,
): ProjectDoneColumn {
	return {
		projectId: doneColumn.project_id,
		doneColumnId: doneColumn.done_column_id,
		requiresDesignation: doneColumn.requires_designation,
	};
}

async function requestProjectColumns<T>(
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
		throw new ProjectColumnRequestError(
			response.status,
			await readProjectColumnErrorDetail(response),
		);
	}

	if (response.status === 204) {
		return undefined as T;
	}

	return response.json() as Promise<T>;
}

async function requestProjectSprints<T>(
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
		throw new ProjectColumnRequestError(
			response.status,
			await readProjectColumnErrorDetail(response),
		);
	}

	return response.json() as Promise<T>;
}

async function readProjectColumnErrorDetail(
	response: Response,
): Promise<string | null> {
	try {
		const body = (await response.json()) as { detail?: unknown };
		return typeof body.detail === "string" ? body.detail : null;
	} catch {
		return null;
	}
}

export async function listProjectColumns(
	projectId: string,
): Promise<ProjectColumn[]> {
	const columns = await requestProjectColumns<ProjectColumnJson[]>(
		`/projects/${projectId}/columns`,
		{ method: "GET" },
	);

	return columns.map(mapProjectColumn);
}

export async function createProjectColumn(
	projectId: string,
	values: CreateProjectColumnInput,
): Promise<ProjectColumn> {
	const column = await requestProjectColumns<ProjectColumnJson>(
		`/projects/${projectId}/columns`,
		{ method: "POST", body: JSON.stringify(values) },
	);

	return mapProjectColumn(column);
}

export async function updateProjectColumn(
	projectId: string,
	columnId: string,
	values: UpdateProjectColumnInput,
): Promise<ProjectColumn> {
	const column = await requestProjectColumns<ProjectColumnJson>(
		`/projects/${projectId}/columns/${columnId}`,
		{ method: "PATCH", body: JSON.stringify(values) },
	);

	return mapProjectColumn(column);
}

export async function reorderProjectColumns(
	projectId: string,
	values: ReorderProjectColumnsInput,
): Promise<ProjectColumn[]> {
	const columns = await requestProjectColumns<ProjectColumnJson[]>(
		`/projects/${projectId}/columns/reorder`,
		{
			method: "PUT",
			body: JSON.stringify({ column_ids: values.columnIds }),
		},
	);

	return columns.map(mapProjectColumn);
}

export async function deleteProjectColumn(
	projectId: string,
	columnId: string,
): Promise<void> {
	await requestProjectColumns<void>(
		`/projects/${projectId}/columns/${columnId}`,
		{ method: "DELETE" },
	);
}

export async function getActiveProjectSprint(
	projectId: string,
): Promise<ProjectSprint | null> {
	const sprint = await requestProjectSprints<ProjectSprintJson | null>(
		`/projects/${projectId}/sprints/active`,
		{ method: "GET" },
	);

	return sprint === null ? null : mapProjectSprint(sprint);
}

export async function createProjectSprint(
	projectId: string,
	values: CreateProjectSprintInput,
): Promise<ProjectSprint> {
	const sprint = await requestProjectSprints<ProjectSprintJson>(
		`/projects/${projectId}/sprints`,
		{
			method: "POST",
			body: JSON.stringify({
				planned_start_date: values.plannedStartDate,
				planned_end_date: values.plannedEndDate,
				goal: values.goal ?? null,
				task_ids: values.taskIds ?? [],
			}),
		},
	);

	return mapProjectSprint(sprint);
}

export async function updateActiveProjectSprint(
	projectId: string,
	values: UpdateProjectSprintInput,
): Promise<ProjectSprint> {
	const sprint = await requestProjectSprints<ProjectSprintJson>(
		`/projects/${projectId}/sprints/active`,
		{
			method: "PATCH",
			body: JSON.stringify({
				planned_start_date: values.plannedStartDate,
				planned_end_date: values.plannedEndDate,
				goal: values.goal,
			}),
		},
	);

	return mapProjectSprint(sprint);
}

export async function getActiveProjectSprintCloseConfirmation(
	projectId: string,
): Promise<ProjectSprintClosePreview> {
	const preview = await requestProjectSprints<ProjectSprintClosePreviewJson>(
		`/projects/${projectId}/sprints/active/close-confirmation`,
		{ method: "GET" },
	);

	return mapProjectSprintClosePreview(preview);
}

export async function closeActiveProjectSprint(
	projectId: string,
): Promise<ProjectSprintCloseResult> {
	const result = await requestProjectSprints<ProjectSprintCloseResultJson>(
		`/projects/${projectId}/sprints/active/close`,
		{ method: "POST" },
	);

	return mapProjectSprintCloseResult(result);
}

export async function listProjectSprintHistory(
	projectId: string,
): Promise<ProjectSprintCloseResult[]> {
	const history = await requestProjectSprints<ProjectSprintCloseResultJson[]>(
		`/projects/${projectId}/sprints/history`,
		{ method: "GET" },
	);

	return history.map(mapProjectSprintCloseResult);
}

export async function getProjectDoneColumn(
	projectId: string,
): Promise<ProjectDoneColumn> {
	const doneColumn = await requestProjectSprints<ProjectDoneColumnJson>(
		`/projects/${projectId}/done-column`,
		{ method: "GET" },
	);

	return mapProjectDoneColumn(doneColumn);
}

export async function updateProjectDoneColumn(
	projectId: string,
	values: UpdateProjectDoneColumnInput,
): Promise<ProjectDoneColumn> {
	const doneColumn = await requestProjectSprints<ProjectDoneColumnJson>(
		`/projects/${projectId}/done-column`,
		{
			method: "PATCH",
			body: JSON.stringify({ done_column_id: values.doneColumnId }),
		},
	);

	return mapProjectDoneColumn(doneColumn);
}

export function projectsQueryOptions() {
	return queryOptions({
		queryKey: projectsQueryKey,
		queryFn: listProjects,
	});
}

export function projectQueryOptions(projectId: string) {
	return queryOptions({
		queryKey: projectQueryKey(projectId),
		queryFn: () => getProject(projectId),
	});
}

export function projectColumnsQueryOptions(projectId: string) {
	return queryOptions({
		queryKey: projectColumnsQueryKey(projectId),
		queryFn: () => listProjectColumns(projectId),
	});
}

export function projectActiveSprintQueryOptions(projectId: string) {
	return queryOptions({
		queryKey: projectActiveSprintQueryKey(projectId),
		queryFn: () => getActiveProjectSprint(projectId),
	});
}

export function projectSprintHistoryQueryOptions(projectId: string) {
	return queryOptions({
		queryKey: projectSprintHistoryQueryKey(projectId),
		queryFn: () => listProjectSprintHistory(projectId),
	});
}

export function projectDoneColumnQueryOptions(projectId: string) {
	return queryOptions({
		queryKey: projectDoneColumnQueryKey(projectId),
		queryFn: () => getProjectDoneColumn(projectId),
	});
}

export function useProjectsQuery() {
	return useQuery(projectsQueryOptions());
}

export function useProjectQuery(projectId: string) {
	return useQuery(projectQueryOptions(projectId));
}

export function useProjectColumnsQuery(projectId: string) {
	return useQuery(projectColumnsQueryOptions(projectId));
}

export function useCreateProjectMutation() {
	return useMutation({ mutationFn: createProject });
}
