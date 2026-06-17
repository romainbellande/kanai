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
export const TASK_SHAPING_CUSTOM_RESPONSE_OPTION_IDENTIFIER = "custom_response";

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

export type TaskShapingAnswerOption = {
	identifier: string;
	label: string;
	detail?: string | null;
	responseText: string;
	isRecommended: boolean;
};

export type TaskShapingInterviewQuestion = {
	text: string;
	answerOptions: TaskShapingAnswerOption[];
};

export type TaskShapingTurnOutput = {
	assistantMessage: string;
	question?: TaskShapingInterviewQuestion | null;
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

	throw new Error("Task Shaping turn artifact was not returned");
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
	const question = normalizeTaskShapingQuestion(record.question);
	const metadataRecord =
		record.metadata && typeof record.metadata === "object"
			? (record.metadata as Record<string, unknown>)
			: {};
	return {
		assistantMessage: record.assistantMessage,
		question,
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

function normalizeTaskShapingQuestion(
	value: unknown,
): TaskShapingInterviewQuestion | null {
	if (!value || typeof value !== "object") {
		return null;
	}

	const record = value as Record<string, unknown>;
	if (typeof record.text !== "string" || !Array.isArray(record.answerOptions)) {
		return null;
	}

	const answerOptions = normalizeTaskShapingAnswerOptions(record.answerOptions);
	if (answerOptions.length === 0) {
		return null;
	}

	return {
		text: record.text,
		answerOptions,
	};
}

function normalizeTaskShapingAnswerOptions(
	value: unknown[],
): TaskShapingAnswerOption[] {
	const seenIdentifiers = new Map<string, number>();
	const normalizedOptions = value.flatMap((option, index) => {
		if (!option || typeof option !== "object") {
			return [];
		}

		const record = option as Record<string, unknown>;
		if (record.identifier === TASK_SHAPING_CUSTOM_RESPONSE_OPTION_IDENTIFIER) {
			return [];
		}

		if (
			typeof record.label !== "string" ||
			typeof record.responseText !== "string"
		) {
			return [];
		}

		const baseIdentifier = uiSafeAnswerOptionIdentifier(
			record.identifier,
			index,
		);
		const duplicateCount = seenIdentifiers.get(baseIdentifier) ?? 0;
		seenIdentifiers.set(baseIdentifier, duplicateCount + 1);
		const identifier = duplicateCount
			? `${baseIdentifier}-${duplicateCount + 1}`
			: baseIdentifier;

		return [
			{
				identifier,
				label: record.label,
				detail: typeof record.detail === "string" ? record.detail : null,
				responseText: record.responseText,
				isRecommended: record.isRecommended === true,
			},
		];
	});

	const firstRecommendedIndex = normalizedOptions.findIndex(
		(option) => option.isRecommended,
	);
	const recommendedIndex =
		firstRecommendedIndex >= 0 ? firstRecommendedIndex : 0;
	const modelOptions = normalizedOptions.map((option, index) => ({
		...option,
		isRecommended: index === recommendedIndex,
	}));
	return [...modelOptions, customResponseAnswerOption()];
}

function customResponseAnswerOption(): TaskShapingAnswerOption {
	return {
		identifier: TASK_SHAPING_CUSTOM_RESPONSE_OPTION_IDENTIFIER,
		label: "Answer in my own words",
		detail: "Write a custom response when the suggested answers do not fit.",
		responseText: "",
		isRecommended: false,
	};
}

function uiSafeAnswerOptionIdentifier(value: unknown, index: number): string {
	const normalized =
		typeof value === "string"
			? value
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/^-|-$/g, "")
			: "";
	return normalized || `option-${index + 1}`;
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
