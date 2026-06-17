// @vitest-environment jsdom

import { waitFor } from "@testing-library/react";
import * as client from "openid-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("openid-client", () => ({
	None: vi.fn(() => ({})),
	allowInsecureRequests: vi.fn(),
	discovery: vi.fn(async () => ({ issuer: "https://auth.example.test" })),
	refreshTokenGrant: vi.fn(),
}));

const authSessionStorageKey = "kanai.openid-client.auth-session";

function storeAuthSession(session: {
	accessToken: string;
	expiresAt?: number;
	refreshToken?: string;
}) {
	window.sessionStorage.setItem(authSessionStorageKey, JSON.stringify(session));
}

function taskShapingAgentCardResponse(): Response {
	return new Response(
		JSON.stringify({
			name: "Task Shaping Chat Agent",
			description: "Starts task shaping.",
			version: "0.1.0",
			capabilities: { streaming: true, pushNotifications: false },
			defaultInputModes: ["application/json"],
			defaultOutputModes: ["application/json"],
			supportedInterfaces: [
				{
					url: "https://api.example.test/a2a/task-shaping",
					protocolBinding: "JSONRPC",
					protocolVersion: "1.0",
				},
			],
			skills: [],
		}),
		{ headers: { "content-type": "application/json" } },
	);
}

function agentCardResponse(): Response {
	return new Response(
		JSON.stringify({
			name: "Acceptance Criteria Agent",
			description: "Generates acceptance criteria.",
			version: "0.1.0",
			capabilities: { streaming: true, pushNotifications: false },
			defaultInputModes: ["application/json"],
			defaultOutputModes: ["text/plain"],
			supportedInterfaces: [
				{
					url: "https://api.example.test/a2a/acceptance-criteria",
					protocolBinding: "JSONRPC",
					protocolVersion: "1.0",
				},
			],
			skills: [],
		}),
		{ headers: { "content-type": "application/json" } },
	);
}

function a2aStreamResponse(...chunks: string[]): Response {
	return a2aStreamResponseWithId(1, ...chunks);
}

function a2aStreamResponseWithId(id: number, ...chunks: string[]): Response {
	const events = chunks.map((chunk, index) => ({
		jsonrpc: "2.0",
		id,
		result: {
			artifactUpdate: {
				taskId: "task-1",
				contextId: "context-1",
				artifact: {
					artifactId: "acceptance-criteria-delta",
					name: "acceptanceCriteriaDelta",
					parts: [{ text: chunk }],
				},
				append: index > 0,
				lastChunk: false,
			},
		},
	}));
	events.push({
		jsonrpc: "2.0",
		id,
		result: {
			artifactUpdate: {
				taskId: "task-1",
				contextId: "context-1",
				artifact: {
					artifactId: "acceptance-criteria-final",
					name: "acceptanceCriteriaFinal",
					parts: [{ text: chunks.join("") }],
				},
				append: false,
				lastChunk: true,
			},
		},
	});

	return new Response(
		events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
		{ headers: { "content-type": "text/event-stream" } },
	);
}

function taskShapingTurnResponse(turn: unknown): Response {
	return a2aStreamResponseFromEvents({
		jsonrpc: "2.0",
		id: 1,
		result: {
			artifactUpdate: {
				taskId: "task-shaping-1",
				contextId: "task-shaping-1",
				artifact: {
					artifactId: "task-shaping-turn",
					name: "taskShapingTurn",
					parts: [{ data: turn }],
				},
				append: false,
				lastChunk: true,
			},
		},
	});
}

function a2aStreamResponseFromEvents(...events: unknown[]): Response {
	return new Response(
		events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
		{ headers: { "content-type": "text/event-stream" } },
	);
}

function abortableA2aStreamResponse(chunk: string): Response {
	const encoder = new TextEncoder();
	return new Response(
		new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify(
							artifactUpdateEvent({
								artifactId: "acceptance-criteria-delta",
								name: "acceptanceCriteriaDelta",
								text: chunk,
							}),
						)}\n\n`,
					),
				);
			},
		}),
		{ headers: { "content-type": "text/event-stream" }, status: 200 },
	);
}

function artifactUpdateEvent(artifact: {
	artifactId: string;
	name?: string;
	text: string;
}) {
	return {
		jsonrpc: "2.0",
		id: 1,
		result: {
			artifactUpdate: {
				taskId: "task-1",
				contextId: "context-1",
				artifact: {
					artifactId: artifact.artifactId,
					name: artifact.name,
					parts: [{ text: artifact.text }],
				},
				append: false,
				lastChunk: false,
			},
		},
	};
}

function findProjectTaskPayload(value: unknown): unknown {
	if (!value || typeof value !== "object") {
		return undefined;
	}

	if ("projectTask" in value || "taskShapingTurn" in value) {
		return value;
	}

	for (const nestedValue of Object.values(value)) {
		const match = findProjectTaskPayload(nestedValue);
		if (match) {
			return match;
		}
	}

	return undefined;
}

function expectTaskShapingPayload(body: string) {
	expect(findProjectTaskPayload(JSON.parse(body))).toEqual({
		projectId: "project-1",
		taskShapingTurn: {
			form: {
				title: "Task title",
				description: "Task description",
				acceptanceCriteria: "Existing criteria",
				priority: "high",
				storyPoints: 5,
				workflowColumn: "Review",
				mode: "create",
			},
			drafts: {
				title: "Draft title",
				description: null,
				acceptanceCriteria: "- Draft criterion",
			},
			transcript: [{ role: "assistant", message: "What is the user pain?" }],
		},
	});
}

function expectProjectTaskPayload(body: string) {
	expect(findProjectTaskPayload(JSON.parse(body))).toEqual({
		projectId: "project-1",
		projectTask: {
			title: "Task title",
			description: "Task description",
			acceptanceCriteria: "Existing criteria",
			priority: "high",
			storyPoints: 5,
			tag: "UX",
			workflowColumn: "Review",
			mode: "create",
		},
	});
}

async function generateAcceptanceCriteria() {
	const { generateAcceptanceCriteria } = await import("./a2a");
	const chunks: string[] = [];
	await generateAcceptanceCriteria({
		projectId: "project-1",
		task: {
			title: "Task title",
			description: "Task description",
			acceptanceCriteria: "Existing criteria",
			priority: "high",
			storyPoints: 5,
			tag: "UX",
			workflowColumn: "Review",
			mode: "create",
		},
		onChunk: (chunk) => chunks.push(chunk),
	});
	return chunks;
}

describe("A2A client helpers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		vi.stubEnv("VITE_AUTH_CLIENT_ID", "kanai-web");
		vi.stubEnv("VITE_AUTH_ISSUER", "https://auth.example.test/realms/kanai");
		window.sessionStorage.clear();
		storeAuthSession({
			accessToken: "access-token",
			expiresAt: Date.now() + 120_000,
			refreshToken: "refresh-token",
		});
	});

	it("uses the SDK client to discover the card and send projectTask data parts", async () => {
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(agentCardResponse())
			.mockResolvedValueOnce(a2aStreamResponse("- First", "\n- Second"));
		vi.stubGlobal("fetch", fetchSpy);

		await expect(generateAcceptanceCriteria()).resolves.toEqual([
			"- First",
			"\n- Second",
		]);

		expect(String(fetchSpy.mock.calls[0][0])).toBe(
			"https://api.example.test/a2a/acceptance-criteria/.well-known/agent-card.json",
		);
		expect(
			new Headers(fetchSpy.mock.calls[0][1]?.headers).get("Authorization"),
		).toBeNull();
		expect(String(fetchSpy.mock.calls[1][0])).toBe(
			"https://api.example.test/a2a/acceptance-criteria",
		);
		expect(
			new Headers(fetchSpy.mock.calls[1][1]?.headers).get("Authorization"),
		).toBe("Bearer access-token");
		expect(
			new Headers(fetchSpy.mock.calls[1][1]?.headers).get("A2A-Version"),
		).toBe("1.0");
		expectProjectTaskPayload(String(fetchSpy.mock.calls[1][1]?.body));
	});

	it("caches the SDK client for the current browser session and API base URL", async () => {
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(agentCardResponse())
			.mockResolvedValueOnce(a2aStreamResponse("- First"))
			.mockResolvedValueOnce(a2aStreamResponseWithId(2, "- Second"));
		vi.stubGlobal("fetch", fetchSpy);

		await expect(generateAcceptanceCriteria()).resolves.toEqual(["- First"]);
		await expect(generateAcceptanceCriteria()).resolves.toEqual(["- Second"]);

		expect(
			fetchSpy.mock.calls.filter((call) =>
				String(call[0]).includes(".well-known/agent-card.json"),
			),
		).toHaveLength(1);
	});

	it("creates a new SDK client when the API base URL changes", async () => {
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(agentCardResponse())
			.mockResolvedValueOnce(a2aStreamResponse("- First"))
			.mockResolvedValueOnce(agentCardResponse())
			.mockResolvedValueOnce(a2aStreamResponse("- Second"));
		vi.stubGlobal("fetch", fetchSpy);

		await expect(generateAcceptanceCriteria()).resolves.toEqual(["- First"]);
		vi.stubEnv("VITE_API_BASE_URL", "https://api-two.example.test");
		await expect(generateAcceptanceCriteria()).resolves.toEqual(["- Second"]);

		expect(String(fetchSpy.mock.calls[0][0])).toBe(
			"https://api.example.test/a2a/acceptance-criteria/.well-known/agent-card.json",
		);
		expect(String(fetchSpy.mock.calls[2][0])).toBe(
			"https://api-two.example.test/a2a/acceptance-criteria/.well-known/agent-card.json",
		);
	});

	it("refreshes the bearer token through SDK fetch hooks after a 401", async () => {
		vi.mocked(client.refreshTokenGrant).mockResolvedValue({
			access_token: "refreshed-token",
			claims: vi.fn(() => undefined),
			expiresIn: vi.fn(() => 120),
			expires_in: 120,
			token_type: "bearer",
		} as unknown as Awaited<ReturnType<typeof client.refreshTokenGrant>>);
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(agentCardResponse())
			.mockResolvedValueOnce(new Response(null, { status: 401 }))
			.mockResolvedValueOnce(a2aStreamResponse("- Refreshed"));
		vi.stubGlobal("fetch", fetchSpy);

		await expect(generateAcceptanceCriteria()).resolves.toEqual([
			"- Refreshed",
		]);

		expect(client.refreshTokenGrant).toHaveBeenCalledTimes(1);
		expect(
			new Headers(fetchSpy.mock.calls[1][1]?.headers).get("Authorization"),
		).toBe("Bearer access-token");
		expect(
			new Headers(fetchSpy.mock.calls[2][1]?.headers).get("Authorization"),
		).toBe("Bearer refreshed-token");
	});

	it("appends only delta artifacts and ignores final full artifacts", async () => {
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(agentCardResponse())
			.mockResolvedValueOnce(
				a2aStreamResponseFromEvents(
					artifactUpdateEvent({
						artifactId: "acceptance-criteria-delta",
						name: "acceptanceCriteriaDelta",
						text: "- Delta one",
					}),
					artifactUpdateEvent({
						artifactId: "acceptance-criteria-final",
						text: "- Delta one\n- Final duplicate",
					}),
					artifactUpdateEvent({
						artifactId: "unrelated-artifact",
						name: "debugTrace",
						text: "debug output",
					}),
					artifactUpdateEvent({
						artifactId: "acceptance-criteria-delta",
						name: "acceptanceCriteriaDelta",
						text: "\n- Delta two",
					}),
				),
			);
		vi.stubGlobal("fetch", fetchSpy);

		await expect(generateAcceptanceCriteria()).resolves.toEqual([
			"- Delta one",
			"\n- Delta two",
		]);
	});

	it("discovers and invokes Task Shaping with structured turn context", async () => {
		const turn = {
			assistantMessage: "What outcome should improve?",
			recommendedAnswer: "Describe the user pain.",
			fieldDrafts: {
				title: "Draft title",
				description: "Draft description",
				acceptanceCriteria: "- Draft criterion",
			},
			metadata: {
				isReady: false,
				readinessReason: "Needs one more answer",
				staleFieldNames: ["title"],
			},
		};
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(taskShapingAgentCardResponse())
			.mockResolvedValueOnce(taskShapingTurnResponse(turn));
		vi.stubGlobal("fetch", fetchSpy);
		const { startTaskShaping } = await import("./a2a");

		await expect(
			startTaskShaping({
				projectId: "project-1",
				task: {
					title: "Task title",
					description: "Task description",
					acceptanceCriteria: "Existing criteria",
					priority: "high",
					storyPoints: 5,
					workflowColumn: "Review",
					mode: "create",
				},
				drafts: {
					title: "Draft title",
					description: null,
					acceptanceCriteria: "- Draft criterion",
				},
				transcript: [{ role: "assistant", message: "What is the user pain?" }],
			}),
		).resolves.toEqual(turn);

		expect(String(fetchSpy.mock.calls[0][0])).toBe(
			"https://api.example.test/a2a/task-shaping/.well-known/agent-card.json",
		);
		expect(
			new Headers(fetchSpy.mock.calls[0][1]?.headers).get("Authorization"),
		).toBeNull();
		expect(String(fetchSpy.mock.calls[1][0])).toBe(
			"https://api.example.test/a2a/task-shaping",
		);
		expect(
			new Headers(fetchSpy.mock.calls[1][1]?.headers).get("Authorization"),
		).toBe("Bearer access-token");
		expectTaskShapingPayload(String(fetchSpy.mock.calls[1][1]?.body));
	});

	it("forwards cancellation through the SDK transport signal", async () => {
		const controller = new AbortController();
		const chunks: string[] = [];
		const request: { signal?: AbortSignal } = {};
		const fetchSpy = vi.fn<typeof fetch>((url, init) => {
			if (String(url).includes(".well-known/agent-card.json")) {
				return Promise.resolve(agentCardResponse());
			}

			request.signal = init?.signal as AbortSignal;
			return Promise.resolve(abortableA2aStreamResponse("- Partial"));
		});
		vi.stubGlobal("fetch", fetchSpy);
		const { generateAcceptanceCriteria } = await import("./a2a");

		const generation = generateAcceptanceCriteria({
			projectId: "project-1",
			signal: controller.signal,
			task: {
				title: "Task title",
				description: "Task description",
				acceptanceCriteria: "Existing criteria",
				priority: "high",
				storyPoints: 5,
				tag: "UX",
				workflowColumn: "Review",
				mode: "edit",
			},
			onChunk: (chunk) => chunks.push(chunk),
		});

		await waitFor(() => expect(chunks).toEqual(["- Partial"]));
		controller.abort();

		await expect(generation).resolves.toBeUndefined();
		expect(request.signal?.aborted).toBe(true);
	});
});
