// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskPrerequisitesField } from "#/domains/workspace/ui/TaskPrerequisitesField";

function renderWithClient(children: ReactNode) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});

	return render(
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
	);
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("TaskPrerequisitesField", () => {
	it("renders without looping when no initial tasks are passed", () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});

		renderWithClient(
			<TaskPrerequisitesField
				columns={[]}
				onChange={() => {}}
				projectId="project-1"
				selectedTaskIds={[]}
			/>,
		);

		expect(screen.getByLabelText("Depends on")).not.toBeNull();
		expect(
			consoleError.mock.calls
				.flat()
				.some((message) =>
					String(message).includes("Maximum update depth exceeded"),
				),
		).toBe(false);
	});
});
