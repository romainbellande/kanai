import { queryOptions, useQuery } from "@tanstack/react-query";

import { type UserRead, UsersApi } from "#/api/openapi-client";

import { createAuthenticatedConfiguration } from "./utils";

export type CurrentUser = {
	id: string;
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
		first_name: user.firstName ?? undefined,
		id: user.id,
		last_name: user.lastName ?? undefined,
	};
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
