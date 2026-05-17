// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { currentUserQueryOptions } from "#/api/client";
import { WorkspaceHeader } from "#/domains/workspace/ui/organisms/WorkspaceHeader";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		...props
	}: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
}));

function renderWithQueryClient(
	ui: ReactNode,
	currentUser?: { id: string; first_name?: string; last_name?: string },
) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				staleTime: Number.POSITIVE_INFINITY,
			},
		},
	});

	queryClient.setQueryData(currentUserQueryOptions().queryKey, currentUser);

	return render(
		<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
	);
}

describe("WorkspaceHeader", () => {
	afterEach(() => {
		cleanup();
	});

	it("renders current-user initials in the account avatar", () => {
		renderWithQueryClient(
			<WorkspaceHeader
				logoutUrl="https://issuer.example.test/logout"
				onLogout={() => undefined}
				sectionTabs={[{ label: "Projects", active: true }]}
			/>,
			{ id: "123", first_name: "John", last_name: "Doe" },
		);

		expect(screen.getByText("JD")).toBeTruthy();
		expect(screen.getByRole("button", { name: /account/i })).toBeTruthy();
	});

	it("falls back to the account label when initials cannot be derived", () => {
		renderWithQueryClient(
			<WorkspaceHeader
				logoutUrl={null}
				onLogout={() => undefined}
				sectionTabs={[{ label: "Projects", active: true }]}
			/>,
			{ id: "123" },
		);

		expect(screen.getByRole("button", { name: /account/i })).toBeTruthy();
		expect(screen.queryByText("JD")).toBeNull();
	});
});
