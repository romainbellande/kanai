import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";

import { createAuthBoundary } from "#/domains/auth/model/auth-boundary";
import { getAuthErrorUrl } from "#/domains/auth/model/openid-client";

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
	const auth = createAuthBoundary();

	try {
		await auth.completeCallback();

		if (
			typeof window !== "undefined" &&
			!auth.isBypassPath(window.location.pathname) &&
			auth.status === "anonymous"
		) {
			await auth.requirePage(
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
