// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthBoundary } from "#/domains/auth/model/auth-boundary";
import { AuthenticatedOutletView } from "#/domains/auth/ui/AuthenticatedOutlet";

function buildAuthBoundary(
	overrides: Partial<AuthBoundary> = {},
): AuthBoundary {
	return {
		accessToken: vi.fn(),
		completeCallback: vi.fn(),
		isBypassPath: vi.fn(() => false),
		logout: vi.fn(),
		refreshAccessToken: vi.fn(),
		requirePage: vi.fn(() => Promise.resolve()),
		status: "anonymous",
		...overrides,
	};
}

describe("AuthenticatedOutlet", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.history.replaceState(null, "", "/");
	});

	it("requires login for anonymous protected routes", async () => {
		const auth = buildAuthBoundary();
		window.history.replaceState(null, "", "/projects/123?view=board#task-1");

		render(
			<AuthenticatedOutletView
				auth={auth}
				pathname="/projects/123"
				outlet={<div data-testid="protected-outlet" />}
			/>,
		);

		expect(screen.queryByTestId("protected-outlet")).toBeNull();
		await waitFor(() => {
			expect(auth.requirePage).toHaveBeenCalledWith(
				"/projects/123?view=board#task-1",
			);
		});
	});

	it("renders bypass paths without requiring login", () => {
		const auth = buildAuthBoundary({ isBypassPath: vi.fn(() => true) });

		render(
			<AuthenticatedOutletView
				auth={auth}
				pathname="/login"
				outlet={<div data-testid="protected-outlet" />}
			/>,
		);

		expect(screen.getByTestId("protected-outlet")).toBeTruthy();
		expect(auth.requirePage).not.toHaveBeenCalled();
	});
});
