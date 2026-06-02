// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTaskForm } from "#/domains/workspace/model/useTaskForm";

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

function createdTask(overrides: Record<string, unknown> = {}) {
	return {
		id: "task-1",
		project_id: "project-1",
		title: "Created task",
		status: "todo",
		priority: "medium",
		rank: "0|hzzzzz:",
		assignee_id: null,
		description: null,
		acceptance_criteria: null,
		tag: null,
		created_at: null,
		updated_at: null,
		...overrides,
	};
}

describe("useTaskForm create mode", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		window.sessionStorage.clear();
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "task-form-token" }),
		);
	});

	it("starts create mode with default values and status fallback", () => {
		const queryClient = createTestQueryClient();

		const { result } = renderHook(
			() =>
				useTaskForm({
					projectId: "project-1",
					mode: "create",
					initialStatus: "archived",
				}),
			{ wrapper: createWrapper(queryClient) },
		);

		expect(result.current.values).toEqual({
			title: "",
			status: "todo",
			priority: "medium",
			description: "",
			acceptanceCriteria: "",
		});
		expect(result.current.isDirty).toBe(false);
		expect(result.current.isSaving).toBe(false);
		expect(result.current.errorMessage).toBeNull();
	});

	it("uses a valid initial status and updates fields", () => {
		const queryClient = createTestQueryClient();

		const { result } = renderHook(
			() =>
				useTaskForm({
					projectId: "project-1",
					mode: "create",
					initialStatus: "in-progress",
				}),
			{ wrapper: createWrapper(queryClient) },
		);

		act(() => {
			result.current.setField("title", "Draft task");
		});

		expect(result.current.values.title).toBe("Draft task");
		expect(result.current.values.status).toBe("in-progress");
		expect(result.current.isDirty).toBe(true);
	});

	it("rejects create submit when title is blank", async () => {
		const queryClient = createTestQueryClient();
		const fetchSpy = vi.fn<typeof fetch>();
		vi.stubGlobal("fetch", fetchSpy);

		const { result } = renderHook(
			() => useTaskForm({ projectId: "project-1", mode: "create" }),
			{ wrapper: createWrapper(queryClient) },
		);

		let submitted: Awaited<ReturnType<typeof result.current.submit>> = null;
		await act(async () => {
			submitted = await result.current.submit();
		});

		expect(submitted).toBeNull();
		expect(result.current.errorMessage).toBe("Task title is required.");
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("normalizes create payload and calls onSaved after success", async () => {
		const queryClient = createTestQueryClient();
		const onSaved = vi.fn();
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify(
					createdTask({
						title: "Created task",
						status: "done",
						priority: "high",
						description: "Useful notes",
						acceptance_criteria: "Done means done",
					}),
				),
				{ headers: { "content-type": "application/json" }, status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchSpy);

		const { result } = renderHook(
			() =>
				useTaskForm({
					projectId: "project-1",
					mode: "create",
					onSaved,
				}),
			{ wrapper: createWrapper(queryClient) },
		);

		act(() => {
			result.current.setField("title", "  Created task  ");
			result.current.setField("status", "done");
			result.current.setField("priority", "high");
			result.current.setField("description", "  Useful notes  ");
			result.current.setField("acceptanceCriteria", "  Done means done  ");
		});

		await act(async () => {
			await result.current.submit();
		});

		await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
		const [, init] = fetchSpy.mock.calls[0];
		expect(JSON.parse(String(init?.body))).toEqual({
			title: "Created task",
			status: "done",
			priority: "high",
			description: "Useful notes",
			acceptance_criteria: "Done means done",
		});
		expect(onSaved).toHaveBeenCalledWith(
			expect.objectContaining({ id: "task-1", title: "Created task" }),
		);
	});

	it("omits blank optional create fields and reports failed submit", async () => {
		const queryClient = createTestQueryClient();
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(JSON.stringify(createdTask({ title: "Minimal task" })), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ detail: "Nope" }), { status: 500 }),
			);
		vi.stubGlobal("fetch", fetchSpy);

		const { result } = renderHook(
			() => useTaskForm({ projectId: "project-1", mode: "create" }),
			{ wrapper: createWrapper(queryClient) },
		);

		act(() => {
			result.current.setField("title", "Minimal task");
			result.current.setField("description", "   ");
			result.current.setField("acceptanceCriteria", "   ");
		});

		await act(async () => {
			await result.current.submit();
		});

		expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({
			title: "Minimal task",
			status: "todo",
			priority: "medium",
		});

		await act(async () => {
			await result.current.submit();
		});

		expect(result.current.errorMessage).toBe(
			"Task could not be created. Please try again.",
		);
	});
});
