import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import {
	createProjectChatSocket,
	listProjectChatMessages,
	mapProjectChatSocketMessage,
	type ProjectChatMessage,
	type ProjectChatSocketEvent,
	projectChatMessagesInfiniteQueryKey,
} from "#/api/client";

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const MAX_CHAT_MESSAGE_BODY_LENGTH = 4_000;

export type ProjectChatState = {
	isOpen: boolean;
	messages: ProjectChatMessage[];
	isLoading: boolean;
	isLoadingOlderMessages: boolean;
	hasOlderMessages: boolean;
	isError: boolean;
	isConnected: boolean;
	isReconnecting: boolean;
	reconnectDelayMs: number | null;
	sendError: string | null;
	lastCreatedClientMessageId: string | null;
	refetch: () => Promise<unknown>;
	loadOlderMessages: () => Promise<unknown>;
	sendMessage: (body: string) => string | null;
};

export function useProjectChat(
	projectId: string,
	isOpen: boolean,
): ProjectChatState {
	const messagesQuery = useInfiniteQuery({
		queryKey: projectChatMessagesInfiniteQueryKey(projectId),
		queryFn: ({ pageParam }) => listProjectChatMessages(projectId, pageParam),
		enabled: isOpen,
		staleTime: 0,
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
	});
	const hasOpenedRef = useRef(false);
	const wasOpenRef = useRef(false);
	const socketRef = useRef<WebSocket | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const [reconnectDelayMs, setReconnectDelayMs] = useState<number | null>(null);
	const [sendError, setSendError] = useState<string | null>(null);
	const [lastCreatedClientMessageId, setLastCreatedClientMessageId] = useState<
		string | null
	>(null);
	const [liveMessages, setLiveMessages] = useState<ProjectChatMessage[]>([]);
	const messagesByPage = messagesQuery.data?.pages ?? [];
	const messagesById = new Map<string, ProjectChatMessage>();

	for (const page of [...messagesByPage].reverse()) {
		for (const message of page.messages) {
			messagesById.set(message.id, message);
		}
	}
	for (const message of liveMessages) {
		messagesById.set(message.id, message);
	}

	useEffect(() => {
		const didOpen = isOpen && !wasOpenRef.current;
		wasOpenRef.current = isOpen;

		if (didOpen && hasOpenedRef.current) {
			void messagesQuery.refetch();
		}
		if (didOpen) {
			hasOpenedRef.current = true;
		}
	}, [isOpen, messagesQuery.refetch]);

	useEffect(() => {
		if (!isOpen) {
			socketRef.current?.close();
			socketRef.current = null;
			setIsConnected(false);
			setReconnectDelayMs(null);
			setSendError(null);
			setLiveMessages([]);
			return;
		}

		let isCurrent = true;
		let didConnectBefore = false;
		let reconnectAttempt = 0;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

		function clearReconnectTimer() {
			if (reconnectTimer) {
				clearTimeout(reconnectTimer);
				reconnectTimer = null;
			}
		}

		function scheduleReconnect() {
			if (!isCurrent || reconnectTimer) {
				return;
			}

			const delayMs = Math.min(
				INITIAL_RECONNECT_DELAY_MS * 2 ** reconnectAttempt,
				MAX_RECONNECT_DELAY_MS,
			);
			reconnectAttempt += 1;
			setReconnectDelayMs(delayMs);
			reconnectTimer = setTimeout(() => {
				reconnectTimer = null;
				void connectSocket();
			}, delayMs);
		}

		async function connectSocket() {
			try {
				const socket = await createProjectChatSocket(projectId);
				if (!isCurrent) {
					socket.close();
					return;
				}

				socketRef.current = socket;
				socket.addEventListener("message", (event) => {
					const socketEvent = parseSocketEvent(event.data);
					if (socketEvent?.type === "ready") {
						const shouldRefetchRecentHistory = didConnectBefore;
						didConnectBefore = true;
						reconnectAttempt = 0;
						setIsConnected(true);
						setReconnectDelayMs(null);
						setSendError(null);
						if (shouldRefetchRecentHistory) {
							void messagesQuery.refetch();
						}
						return;
					}
					if (socketEvent?.type === "created-message") {
						const message = mapProjectChatSocketMessage(socketEvent.message);
						setLiveMessages((current) => {
							const nextMessages = current.filter(
								(currentMessage) => currentMessage.id !== message.id,
							);
							return [...nextMessages, message];
						});
						setLastCreatedClientMessageId(
							socketEvent.client_message_id ?? null,
						);
						setSendError(null);
						return;
					}
					if (socketEvent?.type === "error") {
						setSendError(socketEvent.error.message);
					}
				});
				socket.addEventListener("close", () => {
					if (socketRef.current === socket) {
						socketRef.current = null;
					}
					setIsConnected(false);
					scheduleReconnect();
				});
				socket.addEventListener("error", () => {
					setSendError("Project chat connection failed.");
					socket.close();
				});
			} catch {
				if (!isCurrent) {
					return;
				}
				setIsConnected(false);
				setSendError("Project chat connection failed.");
				scheduleReconnect();
			}
		}

		void connectSocket();

		return () => {
			isCurrent = false;
			clearReconnectTimer();
			socketRef.current?.close();
			socketRef.current = null;
			setIsConnected(false);
			setReconnectDelayMs(null);
		};
	}, [isOpen, projectId, messagesQuery.refetch]);

	function sendMessage(body: string): string | null {
		const socket = socketRef.current;
		if (!isConnected || socket?.readyState !== WebSocket.OPEN) {
			setSendError("Chat is not connected.");
			return null;
		}

		const normalizedBody = body.trim();
		if (!normalizedBody) {
			setSendError("Message cannot be blank.");
			return null;
		}
		if (normalizedBody.length > MAX_CHAT_MESSAGE_BODY_LENGTH) {
			setSendError("Message cannot exceed 4000 characters.");
			return null;
		}

		const clientMessageId = createClientMessageId();
		socket.send(
			JSON.stringify({
				type: "create-message",
				body: normalizedBody,
				client_message_id: clientMessageId,
			}),
		);
		setSendError(null);
		return clientMessageId;
	}

	return {
		isOpen,
		messages: [...messagesById.values()],
		isLoading: messagesQuery.isPending,
		isLoadingOlderMessages: messagesQuery.isFetchingNextPage,
		hasOlderMessages: messagesQuery.hasNextPage,
		isError: messagesQuery.isError,
		isConnected,
		isReconnecting: reconnectDelayMs !== null,
		reconnectDelayMs,
		sendError,
		lastCreatedClientMessageId,
		refetch: messagesQuery.refetch,
		loadOlderMessages: messagesQuery.fetchNextPage,
		sendMessage,
	};
}

function createClientMessageId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}

	return `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseSocketEvent(data: unknown): ProjectChatSocketEvent | null {
	if (typeof data !== "string") {
		return null;
	}

	try {
		return JSON.parse(data) as ProjectChatSocketEvent;
	} catch {
		return null;
	}
}
