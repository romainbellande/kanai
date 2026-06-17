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
const TASK_SHAPING_TURN_ARTIFACT_ID = "task-shaping-turn";
const TASK_SHAPING_TURN_ARTIFACT_NAME = "taskShapingTurn";

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

export type TaskShapingTaskMetadata = Omit<
	AcceptanceCriteriaTaskMetadata,
	"tag"
>;

export type TaskShapingFieldDrafts = {
	title?: string | null;
	description?: string | null;
	acceptanceCriteria?: string | null;
};

export type TaskShapingTranscriptEntry = {
	role: "user" | "assistant";
	message: string;
};

export type TaskShapingTurnOutput = {
	assistantMessage: string;
	recommendedAnswer?: string | null;
	fieldDrafts: TaskShapingFieldDrafts;
	metadata: {
		isReady: boolean;
		readinessReason?: string | null;
		staleFieldNames: string[];
	};
};

export type StartTaskShapingInput = {
	projectId: string;
	task: TaskShapingTaskMetadata;
	drafts?: TaskShapingFieldDrafts;
	transcript?: TaskShapingTranscriptEntry[];
	signal?: AbortSignal;
};

let cachedClients: Record<
	string,
	{
		apiBaseUrl: string;
		fetchImpl: typeof fetch;
		client: Promise<Client>;
	}
> = {};

export async function generateAcceptanceCriteria({
	projectId,
	signal,
	task,
	onChunk,
}: GenerateAcceptanceCriteriaInput): Promise<void> {
	const client = await getA2aClient(
		"acceptance-criteria",
		"/a2a/acceptance-criteria/.well-known/agent-card.json",
	);
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

export async function startTaskShaping({
	drafts = {},
	projectId,
	signal,
	task,
	transcript = [],
}: StartTaskShapingInput): Promise<TaskShapingTurnOutput> {
	const client = await getA2aClient(
		"task-shaping",
		"/a2a/task-shaping/.well-known/agent-card.json",
	);
	const stream = client.sendMessageStream(
		buildTaskShapingRequest(projectId, task, drafts, transcript),
		{
			signal,
		},
	);

	for await (const event of stream) {
		if (signal?.aborted) {
			break;
		}

		const turn = extractTaskShapingTurn(event);
		if (turn) {
			return turn;
		}
	}

	return {
		assistantMessage: "Task Shaping Chat is ready.",
		fieldDrafts: {},
		metadata: { isReady: false, staleFieldNames: [] },
	};
}

function normalizeTaskShapingTurn(
	value: unknown,
): TaskShapingTurnOutput | null {
	if (!value || typeof value !== "object") {
		return null;
	}

	const record = value as Record<string, unknown>;
	if (typeof record.assistantMessage !== "string") {
		return null;
	}

	const fieldDrafts = normalizeTaskShapingFieldDrafts(record.fieldDrafts);
	const metadataRecord =
		record.metadata && typeof record.metadata === "object"
			? (record.metadata as Record<string, unknown>)
			: {};
	return {
		assistantMessage: record.assistantMessage,
		recommendedAnswer:
			typeof record.recommendedAnswer === "string"
				? record.recommendedAnswer
				: null,
		fieldDrafts,
		metadata: {
			isReady: metadataRecord.isReady === true,
			readinessReason:
				typeof metadataRecord.readinessReason === "string"
					? metadataRecord.readinessReason
					: null,
			staleFieldNames: Array.isArray(metadataRecord.staleFieldNames)
				? metadataRecord.staleFieldNames.filter(
						(field): field is string => typeof field === "string",
					)
				: [],
		},
	};
}

function normalizeTaskShapingFieldDrafts(
	value: unknown,
): TaskShapingFieldDrafts {
	if (!value || typeof value !== "object") {
		return {};
	}

	const record = value as Record<string, unknown>;
	return {
		title: typeof record.title === "string" ? record.title : null,
		description:
			typeof record.description === "string" ? record.description : null,
		acceptanceCriteria:
			typeof record.acceptanceCriteria === "string"
				? record.acceptanceCriteria
				: null,
	};
}

function getA2aClient(slug: string, agentCardPath: string): Promise<Client> {
	const apiBaseUrl = getApiBaseUrl();
	const cachedClient = cachedClients[slug];
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
	const client = factory.createFromUrl(apiBaseUrl, agentCardPath);
	cachedClients = {
		...cachedClients,
		[slug]: { apiBaseUrl, fetchImpl: fetch, client },
	};
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

function buildTaskShapingRequest(
	projectId: string,
	task: TaskShapingTaskMetadata,
	drafts: TaskShapingFieldDrafts,
	transcript: TaskShapingTranscriptEntry[],
): SendMessageRequest {
	return {
		tenant: "",
		message: {
			messageId: crypto.randomUUID(),
			contextId: "",
			taskId: "",
			role: Role.ROLE_USER,
			parts: [
				textPart("Start task shaping"),
				dataPart({
					projectId,
					taskShapingTurn: { form: task, drafts, transcript },
				}),
			],
			metadata: undefined,
			extensions: [],
			referenceTaskIds: [],
		},
		configuration: {
			acceptedOutputModes: ["application/json"],
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
	return extractTextArtifact(event, {
		artifactId: ACCEPTANCE_CRITERIA_DELTA_ARTIFACT_ID,
		name: ACCEPTANCE_CRITERIA_DELTA_ARTIFACT_NAME,
	});
}

function extractTaskShapingTurn(
	event: StreamResponse,
): TaskShapingTurnOutput | null {
	if (event.payload?.$case !== "artifactUpdate") {
		return null;
	}

	const artifact = event.payload.value.artifact;
	if (
		artifact?.artifactId !== TASK_SHAPING_TURN_ARTIFACT_ID &&
		artifact?.name !== TASK_SHAPING_TURN_ARTIFACT_NAME
	) {
		return null;
	}

	for (const part of artifact?.parts ?? []) {
		if (part.content?.$case === "data") {
			const turn = normalizeTaskShapingTurn(part.content.value);
			if (turn) {
				return turn;
			}
		}
		if (part.content?.$case === "text") {
			try {
				const turn = normalizeTaskShapingTurn(JSON.parse(part.content.value));
				if (turn) {
					return turn;
				}
			} catch {
				// Ignore text parts that are not JSON Task Shaping turns.
			}
		}
	}
	return null;
}

function extractTextArtifact(
	event: StreamResponse,
	artifact: { artifactId: string; name: string },
): string | null {
	if (event.payload?.$case !== "artifactUpdate") {
		return null;
	}

	const update = event.payload.value;
	if (
		update.artifact?.artifactId !== artifact.artifactId &&
		update.artifact?.name !== artifact.name
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
