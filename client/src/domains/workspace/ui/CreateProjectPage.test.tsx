// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
	useCreateProjectMutation: vi.fn(),
	useCurrentUserQuery: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
	navigate: vi.fn(),
}));

vi.mock("#/api/client", () => ({
	useCreateProjectMutation: apiMocks.useCreateProjectMutation,
	useCurrentUserQuery: apiMocks.useCurrentUserQuery,
}));

vi.mock("#/api/client/index.ts", () => ({
	useCreateProjectMutation: apiMocks.useCreateProjectMutation,
	useCurrentUserQuery: apiMocks.useCurrentUserQuery,
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
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it("submits schema-compatible project data and navigates to the returned API project", async () => {
		const { CreateProjectPage } = await import(
			"#/domains/workspace/ui/CreateProjectPage"
		);
		const mutateAsync = vi.fn().mockResolvedValue({ id: "project-1" });
		apiMocks.useCurrentUserQuery.mockReturnValue({ data: undefined });
		apiMocks.useCreateProjectMutation.mockReturnValue({
			isPending: false,
			mutateAsync,
		});

		render(<CreateProjectPage />);
		fireEvent.change(screen.getByLabelText(/project name/i), {
			target: { value: "Client API Integration" },
		});
		fireEvent.change(screen.getByLabelText(/description/i), {
			target: { value: "Persist this project" },
		});
		fireEvent.submit(getCreateProjectForm());

		await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
		expect(mutateAsync).toHaveBeenCalledWith({
			name: "Client API Integration",
			code: "CLI",
			priority: "medium",
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
		const mutateAsync = vi.fn();
		apiMocks.useCurrentUserQuery.mockReturnValue({ data: undefined });
		apiMocks.useCreateProjectMutation.mockReturnValue({
			isPending: false,
			mutateAsync,
		});

		render(<CreateProjectPage />);
		fireEvent.change(screen.getByLabelText(/project name/i), {
			target: { value: "A" },
		});
		fireEvent.submit(getCreateProjectForm());

		expect(
			await screen.findByText(
				"Project code must be exactly three uppercase letters or numbers.",
			),
		).toBeTruthy();
		expect(mutateAsync).not.toHaveBeenCalled();
	});

	it("keeps form input and shows an inline error when creation fails", async () => {
		const { CreateProjectPage } = await import(
			"#/domains/workspace/ui/CreateProjectPage"
		);
		const mutateAsync = vi.fn().mockRejectedValue(new Error("failed"));
		apiMocks.useCurrentUserQuery.mockReturnValue({ data: undefined });
		apiMocks.useCreateProjectMutation.mockReturnValue({
			isPending: false,
			mutateAsync,
		});

		render(<CreateProjectPage />);
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
