// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProjectChat } from "#/domains/workspace/model/useProjectChat";

function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false },
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

class FakeWebSocket {
	static readonly OPEN = 1;
	static readonly CLOSED = 3;
	static instances: FakeWebSocket[] = [];
	static constructorFailures = 0;

	readonly sentMessages: string[] = [];
	readyState = FakeWebSocket.OPEN;
	private readonly listeners = new Map<
		string,
		((event?: { data: string }) => void)[]
	>();

	constructor(
		readonly url: string | URL,
		readonly protocols?: string | string[],
	) {
		if (FakeWebSocket.constructorFailures > 0) {
			FakeWebSocket.constructorFailures -= 1;
			throw new Error("Socket construction failed.");
		}
		FakeWebSocket.instances.push(this);
	}

	addEventListener(
		eventName: string,
		listener: (event?: { data: string }) => void,
	) {
		this.listeners.set(eventName, [
			...(this.listeners.get(eventName) ?? []),
			listener,
		]);
	}

	send(message: string) {
		this.sentMessages.push(message);
	}

	close() {
		this.readyState = FakeWebSocket.CLOSED;
	}

	emitMessage(payload: unknown) {
		for (const listener of this.listeners.get("message") ?? []) {
			listener({ data: JSON.stringify(payload) });
		}
	}

	emitClose() {
		this.readyState = FakeWebSocket.CLOSED;
		for (const listener of this.listeners.get("close") ?? []) {
			listener();
		}
	}
}

function chatMessageJson(index: number) {
	return {
		author: {
			deleted: false,
			display_name: "Jane Owner",
			id: "owner-1",
			initials: "JO",
		},
		body: `Message ${index}`,
		created_at: new Date(Date.UTC(2026, 0, 1, 12, index)).toISOString(),
		id: `message-${index}`,
		project_id: "project-1",
	};
}

describe("useProjectChat", () => {
	beforeEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		FakeWebSocket.instances = [];
		FakeWebSocket.constructorFailures = 0;
		window.sessionStorage.clear();
		vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
		vi.stubGlobal("WebSocket", FakeWebSocket);
		window.sessionStorage.setItem(
			"kanai.openid-client.auth-session",
			JSON.stringify({ accessToken: "chat-token" }),
		);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("loads older pages with a cursor and keeps messages oldest-to-newest", async () => {
		const latestMessages = Array.from({ length: 50 }, (_, index) =>
			chatMessageJson(index + 50),
		);
		const olderMessages = [chatMessageJson(48), chatMessageJson(49)];
		const fetchSpy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(JSON.stringify(latestMessages), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify(olderMessages), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			);
		vi.stubGlobal("fetch", fetchSpy);

		const queryClient = createTestQueryClient();
		const { result } = renderHook(() => useProjectChat("project-1", true), {
			wrapper: createWrapper(queryClient),
		});

		await waitFor(() => expect(result.current.messages).toHaveLength(50));
		expect(result.current.messages[0]?.id).toBe("message-50");
		expect(result.current.hasOlderMessages).toBe(true);

		await act(async () => {
			await result.current.loadOlderMessages();
		});
		await waitFor(() => expect(result.current.messages).toHaveLength(52));

		expect(fetchSpy).toHaveBeenNthCalledWith(
			2,
			"https://api.example.test/projects/project-1/chat/messages?cursor=message-50",
			expect.objectContaining({ headers: expect.any(Headers) }),
		);
		expect(result.current.messages.map((message) => message.id)).toEqual([
			"message-48",
			"message-49",
			...latestMessages.map((message) => message.id),
		]);
		expect(result.current.hasOlderMessages).toBe(false);
	});

	it("sends through the socket and shows delivery only after server creation", async () => {
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify([]), {
				headers: { "content-type": "application/json" },
				status: 200,
			}),
		);
		vi.stubGlobal("fetch", fetchSpy);

		const queryClient = createTestQueryClient();
		const { result } = renderHook(() => useProjectChat("project-1", true), {
			wrapper: createWrapper(queryClient),
		});

		await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
		const socket = FakeWebSocket.instances[0];
		act(() => {
			socket.emitMessage({ type: "ready", project_id: "project-1" });
		});

		await waitFor(() => expect(result.current.isConnected).toBe(true));
		let clientMessageId: string | null = null;
		act(() => {
			clientMessageId = result.current.sendMessage("  Hello team.  ");
		});

		expect(clientMessageId).toEqual(expect.any(String));
		expect(JSON.parse(socket.sentMessages[0] ?? "{}")).toEqual({
			type: "create-message",
			body: "Hello team.",
			client_message_id: clientMessageId,
		});
		expect(result.current.messages).toEqual([]);

		act(() => {
			socket.emitMessage({
				type: "created-message",
				message: chatMessageJson(1),
				client_message_id: clientMessageId,
			});
		});

		expect(result.current.messages.map((message) => message.id)).toEqual([
			"message-1",
		]);
		expect(result.current.lastCreatedClientMessageId).toBe(clientMessageId);
	});

	it("rejects blank and overlong sends before socket delivery", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn<typeof fetch>().mockResolvedValue(
				new Response(JSON.stringify([]), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			),
		);

		const queryClient = createTestQueryClient();
		const { result } = renderHook(() => useProjectChat("project-1", true), {
			wrapper: createWrapper(queryClient),
		});

		await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
		const socket = FakeWebSocket.instances[0];
		act(() => {
			socket.emitMessage({ type: "ready", project_id: "project-1" });
		});
		await waitFor(() => expect(result.current.isConnected).toBe(true));

		act(() => {
			expect(result.current.sendMessage("   ")).toBeNull();
		});
		expect(result.current.sendError).toBe("Message cannot be blank.");

		act(() => {
			expect(result.current.sendMessage("a".repeat(4001))).toBeNull();
		});
		expect(result.current.sendError).toBe(
			"Message cannot exceed 4000 characters.",
		);
		expect(socket.sentMessages).toEqual([]);
	});

	it("merges socket-created messages without duplicating history messages", async () => {
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify([chatMessageJson(1)]), {
				headers: { "content-type": "application/json" },
				status: 200,
			}),
		);
		vi.stubGlobal("fetch", fetchSpy);

		const queryClient = createTestQueryClient();
		const { result } = renderHook(() => useProjectChat("project-1", true), {
			wrapper: createWrapper(queryClient),
		});

		await waitFor(() => expect(result.current.messages).toHaveLength(1));
		await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));

		act(() => {
			FakeWebSocket.instances[0].emitMessage({
				type: "created-message",
				message: chatMessageJson(1),
			});
		});

		expect(result.current.messages.map((message) => message.id)).toEqual([
			"message-1",
		]);
	});

	it("reconnects with exponential backoff and refetches recent history after reconnect", async () => {
		const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify([]), {
				headers: { "content-type": "application/json" },
				status: 200,
			}),
		);
		vi.stubGlobal("fetch", fetchSpy);

		const queryClient = createTestQueryClient();
		const { result } = renderHook(() => useProjectChat("project-1", true), {
			wrapper: createWrapper(queryClient),
		});

		await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
		act(() => {
			FakeWebSocket.instances[0].emitMessage({
				type: "ready",
				project_id: "project-1",
			});
		});
		await waitFor(() => expect(result.current.isConnected).toBe(true));

		vi.useFakeTimers();
		FakeWebSocket.constructorFailures = 1;
		act(() => {
			FakeWebSocket.instances[0].emitClose();
		});

		expect(result.current.isConnected).toBe(false);
		expect(result.current.isReconnecting).toBe(true);
		expect(result.current.reconnectDelayMs).toBe(1000);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1000);
		});
		expect(result.current.reconnectDelayMs).toBe(2000);
		expect(FakeWebSocket.instances).toHaveLength(1);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(2000);
		});
		expect(FakeWebSocket.instances).toHaveLength(2);

		act(() => {
			FakeWebSocket.instances[1].emitMessage({
				type: "ready",
				project_id: "project-1",
			});
		});

		await act(async () => {});
		expect(result.current.isConnected).toBe(true);
		expect(result.current.isReconnecting).toBe(false);
		expect(fetchSpy).toHaveBeenCalledTimes(2);
	});

	it("stops reconnecting when chat closes", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn<typeof fetch>().mockResolvedValue(
				new Response(JSON.stringify([]), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			),
		);

		const queryClient = createTestQueryClient();
		const { result, rerender } = renderHook(
			({ isOpen }) => useProjectChat("project-1", isOpen),
			{
				initialProps: { isOpen: true },
				wrapper: createWrapper(queryClient),
			},
		);

		await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
		vi.useFakeTimers();
		act(() => {
			FakeWebSocket.instances[0].emitClose();
		});
		expect(result.current.isReconnecting).toBe(true);

		act(() => {
			rerender({ isOpen: false });
		});
		expect(result.current.isReconnecting).toBe(false);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1000);
		});
		expect(FakeWebSocket.instances).toHaveLength(1);
	});

	it("rejects sends while disconnected", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn<typeof fetch>().mockResolvedValue(
				new Response(JSON.stringify([]), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			),
		);

		const queryClient = createTestQueryClient();
		const { result } = renderHook(() => useProjectChat("project-1", true), {
			wrapper: createWrapper(queryClient),
		});

		await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
		act(() => {
			FakeWebSocket.instances[0].emitClose();
		});
		act(() => {
			expect(result.current.sendMessage("No socket delivery.")).toBeNull();
		});

		expect(FakeWebSocket.instances[0].sentMessages).toEqual([]);
		expect(result.current.sendError).toBe("Chat is not connected.");
	});
});
