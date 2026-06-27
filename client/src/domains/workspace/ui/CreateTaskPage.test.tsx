// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	type Project,
	type ProjectColumn,
	projectColumnsQueryOptions,
	projectDoneColumnQueryOptions,
	projectQueryOptions,
} from "#/api/client";

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

function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
			mutations: { retry: false },
		},
	});
}

function project(overrides: Partial<Project> = {}): Project {
	return {
		id: "project-1",
		name: "Launch Plan",
		code: "LCH",
		description: null,
		status: "active",
		ownerIds: [],
		memberIds: [],
		createdAt: null,
		updatedAt: null,
		...overrides,
	};
}

function column(overrides: Partial<ProjectColumn> = {}): ProjectColumn {
	return {
		id: "todo",
		projectId: "project-1",
		name: "Ready",
		description: null,
		position: 0,
		createdAt: null,
		updatedAt: null,
		...overrides,
	};
}

function renderCreateTaskPage(ui: ReactNode) {
	const queryClient = createTestQueryClient();
	queryClient.setQueryData(
		projectQueryOptions("project-1").queryKey,
		project(),
	);
	queryClient.setQueryData(projectColumnsQueryOptions("project-1").queryKey, [
		column(),
	]);
	queryClient.setQueryData(
		projectDoneColumnQueryOptions("project-1").queryKey,
		{
			projectId: "project-1",
			doneColumnId: null,
			requiresDesignation: false,
		},
	);

	return render(
		<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
	);
}

describe("CreateTaskPage", () => {
	beforeEach(() => {
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "task-token" }),
		);
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		window.sessionStorage.clear();
	});

	it("does not apply the slow entry animation to the task form shell", async () => {
		const { CreateTaskPage } = await import(
			"#/domains/workspace/ui/CreateTaskPage"
		);

		const { container } = renderCreateTaskPage(<CreateTaskPage />);
		const shell = container.querySelector(
			'section[class*="bg-[var(--surface-container-lowest)]"]',
		);

		if (!shell) {
			throw new Error("Task form shell was not rendered.");
		}

		expect(shell.className).not.toContain("rise-in");
	});
});
