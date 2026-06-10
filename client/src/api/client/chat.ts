import { queryOptions } from "@tanstack/react-query";

import { fetchAuthenticatedApi, getAccessToken, getApiBaseUrl } from "./utils";

const PROJECT_CHAT_HISTORY_PAGE_SIZE = 50;

export type ProjectChatAuthor = {
	id: string | null;
	displayName: string;
	initials: string;
	deleted: boolean;
};

export type ProjectChatMessage = {
	id: string;
	projectId: string;
	body: string;
	createdAt: Date;
	author: ProjectChatAuthor;
};

export type ProjectChatMessagesPage = {
	messages: ProjectChatMessage[];
	nextCursor: string | null;
};

type ProjectChatMessageJson = {
	id: string;
	project_id: string;
	body: string;
	created_at: string;
	author: {
		id: string | null;
		display_name: string;
		initials: string;
		deleted: boolean;
	};
};

export type ProjectChatSocketEvent =
	| {
			type: "ready";
			project_id: string;
	  }
	| {
			type: "created-message";
			message: ProjectChatMessageJson;
			client_message_id?: string;
	  }
	| {
			type: "error";
			error: {
				code: string;
				message: string;
			};
	  };

export function projectChatMessagesQueryKey(projectId: string) {
	return ["projects", projectId, "chat", "messages"] as const;
}

export function projectChatMessagesInfiniteQueryKey(projectId: string) {
	return ["projects", projectId, "chat", "messages", "infinite"] as const;
}

function mapProjectChatMessage(
	message: ProjectChatMessageJson,
): ProjectChatMessage {
	return {
		id: message.id,
		projectId: message.project_id,
		body: message.body,
		createdAt: new Date(message.created_at),
		author: {
			id: message.author.id,
			displayName: message.author.display_name,
			initials: message.author.initials,
			deleted: message.author.deleted,
		},
	};
}

export function mapProjectChatSocketMessage(
	message: ProjectChatMessageJson,
): ProjectChatMessage {
	return mapProjectChatMessage(message);
}

export async function createProjectChatSocket(
	projectId: string,
): Promise<WebSocket> {
	const token = await getAccessToken();
	const socketUrl = new URL(
		`${getApiBaseUrl()}/projects/${projectId}/chat/socket`,
	);
	socketUrl.protocol = socketUrl.protocol === "https:" ? "wss:" : "ws:";

	return new WebSocket(socketUrl, ["kanai.project-chat", `bearer.${token}`]);
}

export async function listProjectChatMessages(
	projectId: string,
	cursor?: string,
): Promise<ProjectChatMessagesPage> {
	const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
	const response = await fetchAuthenticatedApi(
		`/projects/${projectId}/chat/messages${query}`,
	);

	if (!response.ok) {
		throw new Error(`Project chat request failed with ${response.status}.`);
	}

	const messages = ((await response.json()) as ProjectChatMessageJson[]).map(
		mapProjectChatMessage,
	);
	return {
		messages,
		nextCursor:
			messages.length === PROJECT_CHAT_HISTORY_PAGE_SIZE
				? messages[0]?.id
				: null,
	};
}

export function projectChatMessagesQueryOptions(
	projectId: string,
	enabled = true,
) {
	return queryOptions({
		queryKey: projectChatMessagesQueryKey(projectId),
		queryFn: () => listProjectChatMessages(projectId),
		enabled,
		staleTime: 0,
	});
}
