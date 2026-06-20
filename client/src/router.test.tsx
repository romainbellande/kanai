import { describe, expect, it } from "vitest";

import { getRouter } from "./router";

describe("getRouter", () => {
	it("redirects unmatched routes to /404 with replacement", () => {
		const NotFound = getRouter().options.defaultNotFoundComponent;

		expect(NotFound).toBeDefined();
		expect(NotFound?.({} as never)).toMatchObject({
			props: { replace: true, to: "/404" },
		});
	});
});
