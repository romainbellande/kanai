import { TanStackDevtools } from "@tanstack/react-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { AuthenticatedOutlet } from "#/domains/auth/ui/AuthenticatedOutlet";

import "#/styles.css";

// ponytail: devtools are a dev-only concern; prod builds tree-shake them.
const devtools = import.meta.env.DEV ? (
	<TanStackDevtools
		config={{ position: "bottom-right" }}
		plugins={[
			{ name: "TanStack Router", render: <TanStackRouterDevtoolsPanel /> },
		]}
	/>
) : null;

export function AppShell() {
	return (
		<>
			<AuthenticatedOutlet />
			{devtools}
		</>
	);
}
