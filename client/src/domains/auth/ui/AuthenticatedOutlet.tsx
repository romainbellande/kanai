import { Outlet, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect } from "react";

import type { AuthBoundary } from "#/domains/auth/model/auth-boundary";
import { useAuthBoundary } from "#/domains/auth/model/auth-boundary";
import { getAuthErrorUrl } from "#/domains/auth/model/openid-client";

type AuthenticatedOutletViewProps = {
	auth: AuthBoundary;
	outlet?: ReactNode;
	pathname: string;
};

export function AuthenticatedOutletView({
	auth,
	outlet = <Outlet />,
	pathname,
}: AuthenticatedOutletViewProps) {
	const shouldProtectPage =
		typeof window !== "undefined" && !auth.isBypassPath(pathname);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		if (!shouldProtectPage || auth.status === "authenticated") {
			return;
		}

		void auth
			.requirePage(
				`${pathname}${window.location.search}${window.location.hash}`,
			)
			.catch((error) => {
				window.location.replace(
					getAuthErrorUrl(
						window.location.origin,
						error instanceof Error
							? error.message
							: "Could not start the sign-in flow.",
					),
				);
			});
	}, [auth, pathname, shouldProtectPage]);

	if (shouldProtectPage && auth.status === "anonymous") {
		return null;
	}

	return outlet;
}

export function AuthenticatedOutlet() {
	const auth = useAuthBoundary();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	return <AuthenticatedOutletView auth={auth} pathname={pathname} />;
}
