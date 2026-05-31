import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";

import {
	type ProjectCreate,
	type ProjectRead,
	ProjectsApi,
} from "#/api/openapi-client";

import { createAuthenticatedConfiguration } from "./utils";

export type Project = ProjectRead;
export type CreateProjectInput = ProjectCreate;

export const projectsQueryKey = ["projects"] as const;

export function projectQueryKey(projectId: string) {
	return [...projectsQueryKey, projectId] as const;
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

export function useProjectsQuery() {
	return useQuery(projectsQueryOptions());
}

export function useProjectQuery(projectId: string) {
	return useQuery(projectQueryOptions(projectId));
}

export function useCreateProjectMutation() {
	return useMutation({ mutationFn: createProject });
}
