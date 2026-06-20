// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: unknown) => options,
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
}));

vi.mock("#/domains/auth/model/auth-boundary", () => ({
	useAuthBoundary: () => ({ logout: vi.fn(), status: "authenticated" }),
}));

describe("NotFoundPage", () => {
	afterEach(() => cleanup());

	it("shows generic recovery copy and links back to Projects", async () => {
		const { NotFoundPage } = await import("#/routes/404");

		render(
			<QueryClientProvider client={new QueryClient()}>
				<NotFoundPage />
			</QueryClientProvider>,
		);

		expect(screen.getByText("Page not found")).toBeTruthy();
		expect(
			screen.getByText(/stale, or the item may no longer exist/i),
		).toBeTruthy();
		expect(screen.getByRole("link", { name: "Go to Projects" })).toHaveProperty(
			"href",
			expect.stringContaining("/"),
		);
	});
});
