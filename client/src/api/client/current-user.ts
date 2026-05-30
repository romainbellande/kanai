import { queryOptions, useQuery } from "@tanstack/react-query";

import { Configuration, UsersApi } from "#/api/openapi-client";

import { getAccessToken, getApiBaseUrl } from "./utils";

export type CurrentUser = {
	id: string;
	first_name?: string;
	last_name?: string;
};

const currentUserQueryKey = ["users", "me"] as const;

export { CurrentUserAuthError } from "./utils";

function createUsersApi(): UsersApi {
	return new UsersApi(
		new Configuration({
			basePath: getApiBaseUrl(),
			accessToken: getAccessToken,
		}),
	);
}

export async function getCurrentUser(): Promise<CurrentUser> {
	const usersApi = createUsersApi();
	return (await usersApi.getUsersMeUsersMeGet()) as CurrentUser;
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
