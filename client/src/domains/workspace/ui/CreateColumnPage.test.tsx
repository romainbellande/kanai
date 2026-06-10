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

import {
	currentUserQueryOptions,
	type Project,
	type ProjectColumn,
	projectColumnsQueryOptions,
	projectQueryOptions,
} from "#/api/client";
import { RESERVED_COLUMN_NAME_MESSAGE } from "#/domains/workspace/model/useColumnForm";

const routerMocks = vi.hoisted(() => ({
	navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		params,
		to,
		...props
	}: AnchorHTMLAttributes<HTMLAnchorElement> & {
		children: ReactNode;
		params?: { projectId?: string };
		to: string;
	}) => (
		<a
			href={params?.projectId ? to.replace("$projectId", params.projectId) : to}
			{...props}
		>
			{children}
		</a>
	),
	useNavigate: () => routerMocks.navigate,
	useParams: () => ({ projectId: "project-1" }),
}));

function column(overrides: Partial<ProjectColumn>): ProjectColumn {
	return {
		id: "column-backlog",
		projectId: "project-1",
		name: "Backlog",
		description: null,
		position: 0,
		createdAt: null,
		updatedAt: null,
		...overrides,
	};
}

function project(overrides: Partial<Project> = {}): Project {
	return {
		id: "project-1",
		name: "API Project",
		code: "API",
		priority: "medium",
		description: null,
		status: null,
		ownerIds: ["owner-1"],
		memberIds: [],
		createdAt: null,
		updatedAt: null,
		...overrides,
	};
}

function getCreateColumnForm(): HTMLFormElement {
	const form = screen
		.getByRole("button", { name: /create column/i })
		.closest("form");

	if (!(form instanceof HTMLFormElement)) {
		throw new Error("Create column form was not rendered.");
	}

	return form;
}

function renderWithQueryClient(
	ui: ReactNode,
	{
		currentUserId = "owner-1",
		projectValue = project(),
		columns = [column({}), column({ id: "column-review", name: "Review" })],
	}: {
		currentUserId?: string;
		projectValue?: Project;
		columns?: ProjectColumn[];
	} = {},
) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
		},
	});
	queryClient.setQueryData(currentUserQueryOptions().queryKey, {
		id: currentUserId,
		first_name: "Column",
		last_name: "Creator",
	});
	queryClient.setQueryData(
		projectQueryOptions("project-1").queryKey,
		projectValue,
	);
	queryClient.setQueryData(
		projectColumnsQueryOptions("project-1").queryKey,
		columns,
	);

	return render(
		<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
	);
}

describe("CreateColumnPage", () => {
	beforeEach(() => {
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "column-token" }),
		);
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		window.sessionStorage.clear();
	});

	it("creates a trimmed column with description and navigates back to the board", async () => {
		const { CreateColumnPage } = await import(
			"#/domains/workspace/ui/CreateColumnPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: "column-ready",
					project_id: "project-1",
					name: "Ready",
					description: "Work ready for review.",
					position: 2,
					created_at: null,
					updated_at: null,
				}),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<CreateColumnPage />);
		fireEvent.change(screen.getByLabelText(/column name/i), {
			target: { value: "  Ready  " },
		});
		fireEvent.change(screen.getByLabelText(/description/i), {
			target: { value: "  Work ready for review.  " },
		});
		fireEvent.submit(getCreateColumnForm());

		await waitFor(() =>
			expect(
				fetchSpy.mock.calls.some(
					([url, init]) =>
						String(url).endsWith("/projects/project-1/columns") &&
						init?.method === "POST",
				),
			).toBe(true),
		);
		const [, init] = fetchSpy.mock.calls.find(
			([url, init]) =>
				String(url).endsWith("/projects/project-1/columns") &&
				init?.method === "POST",
		) ?? [null, undefined];
		expect(JSON.parse(String(init?.body))).toEqual({
			name: "Ready",
			description: "Work ready for review.",
		});
		expect(routerMocks.navigate).toHaveBeenCalledWith({
			to: "/projects/$projectId",
			params: { projectId: "project-1" },
		});
	});

	it("validates blank names, reserved names, duplicate names, and overlong descriptions", async () => {
		const { CreateColumnPage } = await import(
			"#/domains/workspace/ui/CreateColumnPage"
		);
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		const fetchSpy = vi.fn<typeof fetch>();
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<CreateColumnPage />);
		fireEvent.submit(getCreateColumnForm());
		expect(await screen.findByText("Column name is required.")).toBeTruthy();

		fireEvent.change(screen.getByLabelText(/column name/i), {
			target: { value: " backlog " },
		});
		fireEvent.submit(getCreateColumnForm());
		expect(await screen.findByText(RESERVED_COLUMN_NAME_MESSAGE)).toBeTruthy();

		fireEvent.change(screen.getByLabelText(/column name/i), {
			target: { value: " review " },
		});
		fireEvent.submit(getCreateColumnForm());
		expect(
			await screen.findByText("A column with this name already exists."),
		).toBeTruthy();

		fireEvent.change(screen.getByLabelText(/column name/i), {
			target: { value: "Ready" },
		});
		fireEvent.change(screen.getByLabelText(/description/i), {
			target: { value: "x".repeat(501) },
		});
		fireEvent.submit(getCreateColumnForm());
		expect(
			await screen.findByText(
				"Column description must be 500 characters or fewer.",
			),
		).toBeTruthy();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("shows unauthorized state for non-owner direct access", async () => {
		const { CreateColumnPage } = await import(
			"#/domains/workspace/ui/CreateColumnPage"
		);

		renderWithQueryClient(<CreateColumnPage />, {
			currentUserId: "member-1",
			projectValue: project({ ownerIds: ["owner-1"], memberIds: ["member-1"] }),
		});

		expect(
			screen.getByText("Only project owners can create columns."),
		).toBeTruthy();
		expect(screen.queryByRole("button", { name: /create column/i })).toBeNull();
		expect(
			(
				screen.getByRole("link", {
					name: /back to board/i,
				}) as HTMLAnchorElement
			).href,
		).toContain("/projects/project-1");
	});

	it("cancels back to the board without saving", async () => {
		const { CreateColumnPage } = await import(
			"#/domains/workspace/ui/CreateColumnPage"
		);
		const fetchSpy = vi.fn<typeof fetch>();
		vi.stubGlobal("fetch", fetchSpy);

		renderWithQueryClient(<CreateColumnPage />);
		const cancelLink = screen.getByRole("link", { name: /cancel/i });
		expect((cancelLink as HTMLAnchorElement).href).toContain(
			"/projects/project-1",
		);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
