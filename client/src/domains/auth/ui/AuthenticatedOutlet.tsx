import { Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

import {
	getAuthErrorUrl,
	hasActiveAuthSession,
	isAuthenticationBypassPath,
	loginWithOpenIdClient,
} from "#/domains/auth/model/openid-client";

export function AuthenticatedOutlet() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const shouldProtectPage =
		typeof window !== "undefined" &&
		!isAuthenticationBypassPath(pathname, window.location.origin);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		if (!shouldProtectPage || hasActiveAuthSession()) {
			return;
		}

		void loginWithOpenIdClient(
			window.location.origin,
			`${pathname}${window.location.search}${window.location.hash}`,
		).catch((error) => {
			window.location.replace(
				getAuthErrorUrl(
					window.location.origin,
					error instanceof Error
						? error.message
						: "Could not start the sign-in flow.",
				),
			);
		});
	}, [pathname, shouldProtectPage]);

	if (shouldProtectPage && !hasActiveAuthSession()) {
		return null;
	}

	return <Outlet />;
}
