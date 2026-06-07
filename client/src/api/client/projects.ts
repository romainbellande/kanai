import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";

import {
	type ProjectCreate,
	type ProjectRead,
	ProjectsApi,
	type ProjectUpdate,
} from "#/api/openapi-client";

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

export const projectsQueryKey = ["projects"] as const;

export function projectQueryKey(projectId: string) {
	return [...projectsQueryKey, projectId] as const;
}

export function projectColumnsQueryKey(projectId: string) {
	return [...projectQueryKey(projectId), "columns"] as const;
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
