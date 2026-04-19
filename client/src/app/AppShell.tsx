import { TanStackDevtools } from "@tanstack/react-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { AuthenticatedOutlet } from "#/domains/auth/ui/AuthenticatedOutlet";

import "#/styles.css";

export function AppShell() {
	return (
		<>
			<AuthenticatedOutlet />
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
