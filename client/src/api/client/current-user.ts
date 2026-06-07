import { queryOptions, useQuery } from "@tanstack/react-query";

import { type UserRead, UsersApi } from "#/api/openapi-client";

import { createAuthenticatedConfiguration } from "./utils";

export type CurrentUser = {
	id: string;
	display_name?: string;
	first_name?: string;
	last_name?: string;
};

const currentUserQueryKey = ["users", "me"] as const;

export { CurrentUserAuthError } from "./utils";

function createUsersApi(): UsersApi {
	return new UsersApi(createAuthenticatedConfiguration());
}

export async function getCurrentUser(): Promise<CurrentUser> {
	const usersApi = createUsersApi();
	const user = (await usersApi.getUsersMeUsersMeGet()) as UserRead;

	return {
		display_name: user.displayName ?? undefined,
		first_name: user.firstName ?? undefined,
		id: user.id,
		last_name: user.lastName ?? undefined,
	};
}

export function getCurrentUserInitials(user: CurrentUser | undefined): string {
	const displayNameParts = user?.display_name
		?.trim()
		.split(/\s+/)
		.filter(Boolean);
	if (displayNameParts?.length) {
		return displayNameParts
			.slice(0, 2)
			.map((part) => part.slice(0, 1).toUpperCase())
			.join("");
	}

	return [user?.first_name, user?.last_name]
		.map((value) => value?.trim().slice(0, 1).toUpperCase() ?? "")
		.join("")
		.trim();
}

export function currentUserQueryOptions() {
	return queryOptions({
		queryKey: currentUserQueryKey,
		queryFn: getCurrentUser,
	});
}

export function useCurrentUserQuery() {
	return useQuery(currentUserQueryOptions());
}
