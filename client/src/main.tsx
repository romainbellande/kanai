import { RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";

import { initOpenIdClient } from "#/lib/openid-client";

import { getRouter } from "./router";

function getRootElement(): HTMLElement {
	const rootElement = document.getElementById("app");

	if (!rootElement) {
		throw new Error('Missing root element with id "app".');
	}

	return rootElement;
}

const rootElement = getRootElement();

async function bootstrap() {
	try {
		await initOpenIdClient();
	} catch (error) {
		console.error("Failed to initialize openid-client", error);
	}

	const root = ReactDOM.createRoot(rootElement);
	const router = getRouter();

	root.render(<RouterProvider router={router} />);
}

if (!rootElement.innerHTML) {
	void bootstrap();
}
