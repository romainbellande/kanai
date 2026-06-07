import { queryOptions } from "@tanstack/react-query";

import { type UserRead, UsersApi } from "#/api/openapi-client";

import {
	createAuthenticatedConfiguration,
	getAccessToken,
	getApiBaseUrl,
} from "./utils";

export type UserProfile = {
	id: string;
	external_id: string;
	display_name?: string;
	first_name?: string;
	last_name?: string;
};

type UserProfileJson = {
	display_name: string | null;
	external_id: string;
	first_name: string | null;
	id: string;
	last_name: string | null;
};

function createUsersApi(): UsersApi {
	return new UsersApi(createAuthenticatedConfiguration());
}

function mapUserProfile(user: UserRead): UserProfile {
	return {
		display_name: user.displayName ?? undefined,
		external_id: user.externalId,
		first_name: user.firstName ?? undefined,
		id: user.id,
		last_name: user.lastName ?? undefined,
	};
}

function mapUserProfileJson(user: UserProfileJson): UserProfile {
	return {
		display_name: user.display_name ?? undefined,
		external_id: user.external_id,
		first_name: user.first_name ?? undefined,
		id: user.id,
		last_name: user.last_name ?? undefined,
	};
}

export function projectAccessUsersQueryKey(
	projectId: string,
	userIds: string[],
) {
	return ["projects", projectId, "access-users", [...userIds].sort()] as const;
}

export function userSearchQueryKey(query: string, limit: number) {
	return ["users", "search", query, limit] as const;
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
	const user = await createUsersApi().getUserEndpointUsersUserIdGet({ userId });

	return mapUserProfile(user);
}

export async function getUserProfiles(
	userIds: string[],
): Promise<UserProfile[]> {
	const uniqueUserIds = [...new Set(userIds)];

	return Promise.all(uniqueUserIds.map((userId) => getUserProfile(userId)));
}

export async function searchUsers(
	query: string,
	limit = 20,
): Promise<UserProfile[]> {
	const token = await getAccessToken();
	const params = new URLSearchParams({ limit: String(limit), q: query });
	const response = await fetch(
		`${getApiBaseUrl()}/users?${params.toString()}`,
		{
			headers: { Authorization: `Bearer ${token}` },
			method: "GET",
		},
	);

	if (!response.ok) {
		throw new Error(`User search request failed with ${response.status}.`);
	}

	const users = (await response.json()) as UserProfileJson[];
	return users.map(mapUserProfileJson);
}

export function projectAccessUsersQueryOptions(
	projectId: string,
	userIds: string[],
	enabled = true,
) {
	const uniqueUserIds = [...new Set(userIds)];

	return queryOptions({
		enabled: enabled && uniqueUserIds.length > 0,
		queryFn: () => getUserProfiles(uniqueUserIds),
		queryKey: projectAccessUsersQueryKey(projectId, uniqueUserIds),
	});
}

export function userSearchQueryOptions(
	query: string,
	limit = 20,
	enabled = true,
) {
	return queryOptions({
		enabled: enabled && query.trim().length >= 2,
		queryFn: () => searchUsers(query.trim(), limit),
		queryKey: userSearchQueryKey(query.trim(), limit),
	});
}

export function getUserDisplayLabel(user: UserProfile): string {
	const displayName = user.display_name?.trim();
	if (displayName) {
		return displayName;
	}

	const fullName = [user.first_name, user.last_name]
		.map((value) => value?.trim())
		.filter(Boolean)
		.join(" ");
	if (fullName) {
		return fullName;
	}

	return user.external_id || user.id;
}

export function getUserInitials(user: UserProfile): string {
	const labelParts = getUserDisplayLabel(user).split(/\s+/).filter(Boolean);

	return labelParts
		.slice(0, 2)
		.map((part) => part.slice(0, 1).toUpperCase())
		.join("");
}
