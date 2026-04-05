import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRoute,
	Outlet,
	useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useEffect } from "react";

import {
	getAuthErrorUrl,
	hasActiveAuthSession,
	isAuthenticationBypassPath,
	loginWithOpenIdClient,
} from "#/lib/openid-client";

import "../styles.css";

export const Route = createRootRoute({
	component: RootComponent,
});

function RootComponent() {
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
						: "Could not start the Keycloak sign-in flow.",
				),
			);
		});
	}, [pathname, shouldProtectPage]);

	if (shouldProtectPage && !hasActiveAuthSession()) {
		return null;
	}

	return (
		<>
			<Outlet />
			<TanStackDevtools
				config={{
					position: "bottom-right",
				}}
				plugins={[
					{
						name: "TanStack Router",
						render: <TanStackRouterDevtoolsPanel />,
					},
				]}
			/>
		</>
	);
}
