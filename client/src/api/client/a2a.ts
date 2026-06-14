import { fetchAuthenticatedApi } from "./utils";

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

type A2ATextPart = {
	kind: string;
	text?: unknown;
};

type A2AStreamMessage = {
	result?: {
		message?: {
			parts?: A2ATextPart[];
		};
	};
};

export async function generateAcceptanceCriteria({
	projectId,
	signal,
	task,
	onChunk,
}: GenerateAcceptanceCriteriaInput): Promise<void> {
	const response = await fetchAuthenticatedApi("/a2a/acceptance-criteria", {
		method: "POST",
		signal,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: crypto.randomUUID(),
			method: "message/stream",
			params: {
				message: {
					role: "user",
					parts: [{ kind: "text", text: "Generate acceptance criteria" }],
					metadata: {
						projectId,
						task,
					},
				},
			},
		}),
	});

	if (!response.ok) {
		throw new Error(
			`Acceptance criteria generation failed with ${response.status}.`,
		);
	}

	if (!response.body) {
		return;
	}

	await readNdjsonTextParts(response.body, onChunk, signal);
}

async function readNdjsonTextParts(
	body: ReadableStream<Uint8Array>,
	onChunk: (text: string) => void,
	signal?: AbortSignal,
): Promise<void> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	const cancelReader = () => {
		void reader.cancel();
	};
	signal?.addEventListener("abort", cancelReader, { once: true });

	try {
		while (!signal?.aborted) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}

			buffer += decoder.decode(value, { stream: true });
			buffer = emitCompleteLines(buffer, onChunk);
		}

		buffer += decoder.decode();
		if (buffer.trim()) {
			emitLine(buffer, onChunk);
		}
	} finally {
		signal?.removeEventListener("abort", cancelReader);
	}
}

function emitCompleteLines(
	buffer: string,
	onChunk: (text: string) => void,
): string {
	const lines = buffer.split("\n");
	const remainder = lines.pop() ?? "";

	for (const line of lines) {
		emitLine(line, onChunk);
	}

	return remainder;
}

function emitLine(line: string, onChunk: (text: string) => void): void {
	if (!line.trim()) {
		return;
	}

	const message = JSON.parse(line) as A2AStreamMessage;
	for (const part of message.result?.message?.parts ?? []) {
		if (part.kind === "text" && typeof part.text === "string") {
			onChunk(part.text);
		}
	}
}
