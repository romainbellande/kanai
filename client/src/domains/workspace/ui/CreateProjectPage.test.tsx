// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routerMocks = vi.hoisted(() => ({
	navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		...props
	}: AnchorHTMLAttributes<HTMLAnchorElement> & {
		children: ReactNode;
		to: string;
	}) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
	useNavigate: () => routerMocks.navigate,
}));

function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});
}

function renderWithQueryClient(ui: ReactNode) {
	return render(
		<QueryClientProvider client={createTestQueryClient()}>
			{ui}
		</QueryClientProvider>,
	);
}

function createdProjectResponse() {
	return {
		id: "project-1",
		name: "Client API Integration",
		code: "CLI",
		description: "Persist this project",
		status: "active",
		owner_ids: [],
		member_ids: [],
		created_at: null,
		updated_at: null,
	};
}

function projectCreateCalls(fetchSpy: ReturnType<typeof vi.fn<typeof fetch>>) {
	return fetchSpy.mock.calls.filter(
		([url, init]) =>
			String(url).endsWith("/projects") && init?.method === "POST",
	);
}

function getCreateProjectForm(): HTMLFormElement {
	const form = screen
		.getByRole("button", { name: /create project/i })
		.closest("form");

	if (!(form instanceof HTMLFormElement)) {
		throw new Error("Create project form was not rendered.");
	}

	return form;
}

describe("CreateProjectPage", () => {
	beforeEach(() => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "project-token" }),
		);
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		window.sessionStorage.clear();
	});

	it("submits schema-compatible project data and navigates to the returned API project", async () => {
		const { CreateProjectPage } = await import(
			"#/domains/workspace/ui/CreateProjectPage"
		);
		const fetchSpy = vi.fn<typeof fetch>().mockImplementation((url) => {
			if (String(url).endsWith("/users/me")) {
				return Promise.resolve(
					new Response(JSON.stringify({ id: "user-1" }), {
						headers: { "content-type": "application/json" },
						status: 200,
					}),
				);
			}

			return Promise.resolve(
				new Response(JSON.stringify(createdProjectResponse()), {
					headers: { "content-type": "application/json" },
					status: 201,
				}),
			);
		});
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<CreateProjectPage />);
		fireEvent.change(screen.getByLabelText(/project name/i), {
			target: { value: "Client API Integration" },
		});
		fireEvent.change(screen.getByLabelText(/description/i), {
			target: { value: "Persist this project" },
		});
		fireEvent.submit(getCreateProjectForm());

		await waitFor(() => expect(projectCreateCalls(fetchSpy)).toHaveLength(1));
		const [, init] = projectCreateCalls(fetchSpy)[0];
		expect(JSON.parse(String(init?.body))).toEqual({
			name: "Client API Integration",
			code: "CLI",
			status: "active",
			description: "Persist this project",
		});
		expect(routerMocks.navigate).toHaveBeenCalledWith({
			to: "/projects/$projectId",
			params: { projectId: "project-1" },
		});
	});

	it("validates the three-character uppercase project code before submit", async () => {
		const { CreateProjectPage } = await import(
			"#/domains/workspace/ui/CreateProjectPage"
		);
		const fetchSpy = vi.fn<typeof fetch>();
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<CreateProjectPage />);
		fireEvent.change(screen.getByLabelText(/project name/i), {
			target: { value: "A" },
		});
		fireEvent.submit(getCreateProjectForm());

		expect(
			await screen.findByText(
				"Project code must be exactly three uppercase letters or numbers.",
			),
		).toBeTruthy();
		expect(projectCreateCalls(fetchSpy)).toHaveLength(0);
	});

	it("keeps form input and shows an inline error when creation fails", async () => {
		const { CreateProjectPage } = await import(
			"#/domains/workspace/ui/CreateProjectPage"
		);
		vi.stubGlobal(
			"fetch",
			vi
				.fn<typeof fetch>()
				.mockResolvedValue(
					new Response(JSON.stringify({ detail: "failed" }), { status: 500 }),
				),
		);

		renderWithQueryClient(<CreateProjectPage />);
		const nameInput = screen.getByLabelText(
			/project name/i,
		) as HTMLInputElement;
		fireEvent.change(nameInput, { target: { value: "Failed Project" } });
		fireEvent.submit(getCreateProjectForm());

		expect(
			await screen.findByText(
				"Project could not be created. Please try again.",
			),
		).toBeTruthy();
		expect(nameInput.value).toBe("Failed Project");
		expect(routerMocks.navigate).not.toHaveBeenCalled();
	});
});
