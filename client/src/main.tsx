import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";

import {
	getAuthErrorUrl,
	hasActiveAuthSession,
	initOpenIdClient,
	isAuthenticationBypassPath,
	loginWithOpenIdClient,
} from "#/domains/auth/model/openid-client";

import { getRouter } from "./router";

function getRootElement(): HTMLElement {
	const rootElement = document.getElementById("app");

	if (!rootElement) {
		throw new Error('Missing root element with id "app".');
	}

	return rootElement;
}

const rootElement = getRootElement();
const queryClient = new QueryClient();

async function bootstrap() {
	try {
		await initOpenIdClient();

		if (
			typeof window !== "undefined" &&
			!isAuthenticationBypassPath(
				window.location.pathname,
				window.location.origin,
			) &&
			!hasActiveAuthSession()
		) {
			await loginWithOpenIdClient(
				window.location.origin,
				`${window.location.pathname}${window.location.search}${window.location.hash}`,
			);
			return;
		}
	} catch (error) {
		console.error("Failed to initialize openid-client", error);

		if (typeof window !== "undefined") {
			window.location.replace(
				getAuthErrorUrl(
					window.location.origin,
					error instanceof Error
						? error.message
						: "Could not start the sign-in flow.",
				),
			);
			return;
		}
	}

	const root = ReactDOM.createRoot(rootElement);
	const router = getRouter();

	root.render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);
}

if (!rootElement.innerHTML) {
	void bootstrap();
}
