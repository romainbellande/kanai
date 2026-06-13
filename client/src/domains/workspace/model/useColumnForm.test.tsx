// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Project, ProjectColumn, Task } from "#/api/client";
import {
	getColumnFormAccessState,
	RESERVED_COLUMN_NAME_MESSAGE,
	useColumnForm,
} from "#/domains/workspace/model/useColumnForm";

function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
			mutations: { retry: false },
		},
	});
}

function createWrapper(queryClient: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

function project(overrides: Partial<Project> = {}): Project {
	return {
		id: "project-1",
		name: "Project",
		code: "PRJ",
		description: null,
		status: "active",
		ownerIds: ["user-1"],
		memberIds: [],
		createdAt: null,
		updatedAt: null,
		...overrides,
	};
}

function column(overrides: Partial<ProjectColumn> = {}): ProjectColumn {
	return {
		id: "column-1",
		projectId: "project-1",
		name: "Backlog",
		description: "Ideas to sort",
		position: 0,
		createdAt: null,
		updatedAt: null,
		...overrides,
	};
}

function task(overrides: Partial<Task> = {}): Task {
	return {
		id: "task-1",
		projectId: "project-1",
		sprintId: null,
		backlogRank: null,
		title: "Task",
		columnId: "column-1",
		priority: "medium",
		storyPoints: null,
		rank: "a0",
		assigneeId: null,
		description: null,
		acceptanceCriteria: null,
		tag: null,
		createdAt: null,
		updatedAt: null,
		...overrides,
	};
}

describe("getColumnFormAccessState", () => {
	it("reports loading, unauthorized, not-found, and ready states", () => {
		expect(
			getColumnFormAccessState({
				column: null,
				columns: undefined,
				currentUserId: undefined,
				isColumnsLoading: true,
				isCurrentUserLoading: false,
				isProjectLoading: false,
				project: undefined,
			}),
		).toMatchObject({ status: "loading" });
		expect(
			getColumnFormAccessState({
				column: null,
				columns: [column()],
				currentUserId: "user-1",
				isColumnsLoading: false,
				isCurrentUserLoading: false,
				isProjectLoading: false,
				project: project(),
			}),
		).toMatchObject({ status: "not-found" });
		expect(
			getColumnFormAccessState({
				column: column(),
				columns: [column()],
				currentUserId: "member-1",
				isColumnsLoading: false,
				isCurrentUserLoading: false,
				isProjectLoading: false,
				project: project(),
			}),
		).toMatchObject({ status: "unauthorized" });
		expect(
			getColumnFormAccessState({
				column: column(),
				columns: [column()],
				currentUserId: "user-1",
				isColumnsLoading: false,
				isCurrentUserLoading: false,
				isProjectLoading: false,
				project: project(),
			}),
		).toMatchObject({ status: "ready" });
	});
});

describe("useColumnForm", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		window.sessionStorage.clear();
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "column-form-token" }),
		);
	});

	it("validates blank, duplicate, and overlong description values", async () => {
		const queryClient = createTestQueryClient();
		const { result } = renderHook(
			() =>
				useColumnForm({
					projectId: "project-1",
					columnId: "column-1",
					project: project(),
					columns: [column(), column({ id: "column-2", name: "Review" })],
					currentUserId: "user-1",
					isProjectLoading: false,
					isColumnsLoading: false,
					isCurrentUserLoading: false,
				}),
			{ wrapper: createWrapper(queryClient) },
		);

		await act(async () => {
			result.current.setField("name", "   ");
			await result.current.submit();
		});
		expect(result.current.errorMessage).toBe("Column name is required.");

		await act(async () => {
			result.current.setField("name", " review ");
			await result.current.submit();
		});
		expect(result.current.errorMessage).toBe(
			"A column with this name already exists.",
		);

		await act(async () => {
			result.current.setField("name", "Next");
			result.current.setField("description", "a".repeat(501));
			await result.current.submit();
		});
		expect(result.current.errorMessage).toBe(
			"Column description must be 500 characters or fewer.",
		);
	});

	it("rejects reserved Backlog names before saving", async () => {
		const queryClient = createTestQueryClient();
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const { result } = renderHook(
			() =>
				useColumnForm({
					projectId: "project-1",
					columnId: "column-1",
					project: project(),
					columns: [column({ name: "To Do" })],
					currentUserId: "user-1",
					isProjectLoading: false,
					isColumnsLoading: false,
					isCurrentUserLoading: false,
				}),
			{ wrapper: createWrapper(queryClient) },
		);

		await act(async () => {
			result.current.setField("name", " BACKLOG ");
			await result.current.submit();
		});

		expect(result.current.errorMessage).toBe(RESERVED_COLUMN_NAME_MESSAGE);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("trims and saves values", async () => {
		const queryClient = createTestQueryClient();
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: "column-1",
					project_id: "project-1",
					name: "Review",
					description: "Ready for review",
					position: 0,
					created_at: null,
					updated_at: null,
				}),
				{ status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchMock);
		const onSaved = vi.fn();
		const { result } = renderHook(
			() =>
				useColumnForm({
					projectId: "project-1",
					columnId: "column-1",
					project: project(),
					columns: [column()],
					currentUserId: "user-1",
					isProjectLoading: false,
					isColumnsLoading: false,
					isCurrentUserLoading: false,
					onSaved,
				}),
			{ wrapper: createWrapper(queryClient) },
		);

		await act(async () => {
			result.current.setField("name", " Review ");
			result.current.setField("description", " Ready for review ");
			await result.current.submit();
		});

		expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
			name: "Review",
			description: "Ready for review",
		});
		expect(onSaved).toHaveBeenCalledWith(
			expect.objectContaining({ name: "Review" }),
		);
	});

	it("preserves local values after save failure", async () => {
		const queryClient = createTestQueryClient();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response("{}", { status: 500 })),
		);
		const { result } = renderHook(
			() =>
				useColumnForm({
					projectId: "project-1",
					columnId: "column-1",
					project: project(),
					columns: [column()],
					currentUserId: "user-1",
					isProjectLoading: false,
					isColumnsLoading: false,
					isCurrentUserLoading: false,
				}),
			{ wrapper: createWrapper(queryClient) },
		);

		await act(async () => {
			result.current.setField("name", "Blocked");
			result.current.setField("description", "Keep this local copy");
			await result.current.submit();
		});

		expect(result.current.errorMessage).toBe(
			"Column could not be saved. Please try again.",
		);
		expect(result.current.values).toEqual({
			name: "Blocked",
			description: "Keep this local copy",
		});
	});

	it("reports delete disabled reasons for non-empty and final columns", () => {
		const queryClient = createTestQueryClient();
		const { result, rerender } = renderHook(
			({ columns, tasks }: { columns: ProjectColumn[]; tasks: Task[] }) =>
				useColumnForm({
					projectId: "project-1",
					columnId: "column-1",
					project: project(),
					columns,
					tasks,
					currentUserId: "user-1",
					isProjectLoading: false,
					isColumnsLoading: false,
					isTasksLoading: false,
					isCurrentUserLoading: false,
				}),
			{
				initialProps: {
					columns: [column()],
					tasks: [] as Task[],
				},
				wrapper: createWrapper(queryClient),
			},
		);

		expect(result.current.deleteDisabledReason).toBe(
			"You cannot delete the final project column.",
		);

		rerender({
			columns: [column(), column({ id: "column-2", name: "Done" })],
			tasks: [task()],
		});
		expect(result.current.deleteDisabledReason).toBe(
			"Move or remove this column's tasks before deleting it.",
		);
	});

	it("confirms and deletes an empty non-final column", async () => {
		const queryClient = createTestQueryClient();
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response(null, { status: 204 }));
		vi.stubGlobal("fetch", fetchMock);
		vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
		const onDeleted = vi.fn();
		const { result } = renderHook(
			() =>
				useColumnForm({
					projectId: "project-1",
					columnId: "column-1",
					project: project(),
					columns: [column(), column({ id: "column-2", name: "Done" })],
					tasks: [],
					currentUserId: "user-1",
					isProjectLoading: false,
					isColumnsLoading: false,
					isTasksLoading: false,
					isCurrentUserLoading: false,
					onDeleted,
				}),
			{ wrapper: createWrapper(queryClient) },
		);

		await act(async () => {
			result.current.setField("name", "Unsaved name");
			await result.current.deleteColumn();
		});

		expect(window.confirm).toHaveBeenCalledWith(
			'Delete "Backlog"? Unsaved edits will be discarded.',
		);
		expect(fetchMock.mock.calls[0][0]).toBe(
			"https://api.example.test/projects/project-1/columns/column-1",
		);
		expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
		expect(onDeleted).toHaveBeenCalled();
	});

	it("shows a safe delete error when deletion fails", async () => {
		const queryClient = createTestQueryClient();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response("{}", { status: 409 })),
		);
		vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
		const { result } = renderHook(
			() =>
				useColumnForm({
					projectId: "project-1",
					columnId: "column-1",
					project: project(),
					columns: [column(), column({ id: "column-2", name: "Done" })],
					tasks: [],
					currentUserId: "user-1",
					isProjectLoading: false,
					isColumnsLoading: false,
					isTasksLoading: false,
					isCurrentUserLoading: false,
				}),
			{ wrapper: createWrapper(queryClient) },
		);

		await act(async () => {
			await result.current.deleteColumn();
		});

		expect(result.current.deleteErrorMessage).toBe(
			"Column could not be deleted. Please try again.",
		);
	});
});
