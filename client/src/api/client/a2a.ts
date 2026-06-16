import type { Part, SendMessageRequest, StreamResponse } from "@a2a-js/sdk";
import { Role } from "@a2a-js/sdk";
import type { Client } from "@a2a-js/sdk/client";
import {
	ClientFactory,
	ClientFactoryOptions,
	createAuthenticatingFetchWithRetry,
	JsonRpcTransportFactory,
} from "@a2a-js/sdk/client";

import { getAccessToken, getApiBaseUrl, refreshAccessToken } from "./utils";

const ACCEPTANCE_CRITERIA_DELTA_ARTIFACT_ID = "acceptance-criteria-delta";
const ACCEPTANCE_CRITERIA_DELTA_ARTIFACT_NAME = "acceptanceCriteriaDelta";

export type AcceptanceCriteriaTaskMetadata = {
	title: string | null;
	description: string | null;
	acceptanceCriteria: string | null;
	priority: string | null;
	storyPoints: number | null;
	tag: string | null;
	workflowColumn: string | null;
	mode: "create" | "edit";
};

export type GenerateAcceptanceCriteriaInput = {
	projectId: string;
	task: AcceptanceCriteriaTaskMetadata;
	onChunk: (text: string) => void;
	signal?: AbortSignal;
};

let cachedClient: {
	apiBaseUrl: string;
	fetchImpl: typeof fetch;
	client: Promise<Client>;
} | null = null;

export async function generateAcceptanceCriteria({
	projectId,
	signal,
	task,
	onChunk,
}: GenerateAcceptanceCriteriaInput): Promise<void> {
	const client = await getAcceptanceCriteriaClient();
	const stream = client.sendMessageStream(
		buildAcceptanceCriteriaRequest(projectId, task),
		{ signal },
	);
	const iterator = stream[Symbol.asyncIterator]();
	let abortStream: (() => void) | null = null;
	const abortPromise = new Promise<IteratorResult<StreamResponse>>(
		(resolve) => {
			abortStream = () => resolve({ done: true, value: undefined });
			signal?.addEventListener("abort", abortStream, { once: true });
		},
	);

	try {
		while (!signal?.aborted) {
			const result = await Promise.race([iterator.next(), abortPromise]);
			if (result.done) {
				break;
			}

			const text = extractArtifactDeltaText(result.value);
			if (text) {
				onChunk(text);
			}
		}
	} finally {
		if (abortStream) {
			signal?.removeEventListener("abort", abortStream);
		}
		void iterator.return?.();
	}
}

function getAcceptanceCriteriaClient(): Promise<Client> {
	const apiBaseUrl = getApiBaseUrl();
	if (
		cachedClient?.apiBaseUrl === apiBaseUrl &&
		cachedClient.fetchImpl === fetch
	) {
		return cachedClient.client;
	}

	const authFetch = createAuthenticatingFetchWithRetry(fetch, {
		headers: async () => ({
			Authorization: `Bearer ${await getAccessToken()}`,
		}),
		shouldRetryWithHeaders: async (_request, response) => {
			if (response.status !== 401) {
				return undefined;
			}

			return { Authorization: `Bearer ${await refreshAccessToken()}` };
		},
	});
	const factory = new ClientFactory(
		ClientFactoryOptions.createFrom(ClientFactoryOptions.default, {
			transports: [new JsonRpcTransportFactory({ fetchImpl: authFetch })],
		}),
	);
	const client = factory.createFromUrl(
		apiBaseUrl,
		"/a2a/acceptance-criteria/.well-known/agent-card.json",
	);
	cachedClient = { apiBaseUrl, fetchImpl: fetch, client };
	return client;
}

function buildAcceptanceCriteriaRequest(
	projectId: string,
	task: AcceptanceCriteriaTaskMetadata,
): SendMessageRequest {
	return {
		tenant: "",
		message: {
			messageId: crypto.randomUUID(),
			contextId: "",
			taskId: "",
			role: Role.ROLE_USER,
			parts: [
				textPart("Generate acceptance criteria"),
				dataPart({ projectId, projectTask: task }),
			],
			metadata: undefined,
			extensions: [],
			referenceTaskIds: [],
		},
		configuration: {
			acceptedOutputModes: ["text/plain"],
			taskPushNotificationConfig: undefined,
			returnImmediately: false,
		},
		metadata: undefined,
	};
}

function textPart(text: string): Part {
	return {
		content: { $case: "text", value: text },
		metadata: undefined,
		filename: "",
		mediaType: "text/plain",
	};
}

function dataPart(data: Record<string, unknown>): Part {
	return {
		content: { $case: "data", value: data },
		metadata: undefined,
		filename: "",
		mediaType: "application/json",
	};
}

function extractArtifactDeltaText(event: StreamResponse): string | null {
	if (event.payload?.$case !== "artifactUpdate") {
		return null;
	}

	const update = event.payload.value;
	if (
		update.artifact?.artifactId !== ACCEPTANCE_CRITERIA_DELTA_ARTIFACT_ID &&
		update.artifact?.name !== ACCEPTANCE_CRITERIA_DELTA_ARTIFACT_NAME
	) {
		return null;
	}

	return (
		update.artifact?.parts
			.map((part) =>
				part.content?.$case === "text" ? part.content.value : null,
			)
			.filter((text): text is string => text !== null)
			.join("") ?? null
	);
}
