import { useRef, useState } from "react";

import {
	startTaskShaping,
	TASK_SHAPING_CUSTOM_RESPONSE_OPTION_IDENTIFIER,
	type TaskShapingFieldDrafts,
	type TaskShapingTaskMetadata,
	type TaskShapingTranscriptEntry,
	type TaskShapingTurnOutput,
} from "#/api/client";
import { Button } from "#/components/ui/button";
import { Field, FieldLabel } from "#/components/ui/field";
import { Textarea } from "#/components/ui/textarea";
import {
	getStaleTaskShapingDraftFields,
	type TaskFormValues,
	type TaskShapingDraftField,
	type TaskShapingDraftSources,
} from "#/domains/workspace/model/useTaskForm";

function blankToNull(value: string): string | null {
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

const TASK_SHAPING_DRAFT_LABELS: Record<TaskShapingDraftField, string> = {
	title: "Title",
	description: "Description",
	acceptanceCriteria: "Acceptance Criteria",
};

const TASK_SHAPING_DRAFT_FIELDS = Object.keys(
	TASK_SHAPING_DRAFT_LABELS,
) as TaskShapingDraftField[];

type TaskShapingChatProps = {
	projectId: string;
	mode: TaskShapingTaskMetadata["mode"];
	values: TaskFormValues;
	workflowColumnName: string | null;
	draftApplication: {
		applyDraft: (
			name: TaskShapingDraftField,
			drafts: TaskShapingFieldDrafts,
		) => void;
		applyAllDrafts: (drafts: TaskShapingFieldDrafts) => void;
	};
	onDraftApplied?: () => void;
};

export function TaskShapingChat({
	draftApplication,
	mode,
	onDraftApplied,
	projectId,
	values,
	workflowColumnName,
}: TaskShapingChatProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [isTurnLoading, setIsTurnLoading] = useState(false);
	const [drafts, setDrafts] = useState<TaskShapingTurnOutput["fieldDrafts"]>(
		{},
	);
	const [draftSources, setDraftSources] = useState<TaskShapingDraftSources>({});
	const [transcript, setTranscript] = useState<TaskShapingTranscriptEntry[]>(
		[],
	);
	const [activeQuestion, setActiveQuestion] =
		useState<TaskShapingTurnOutput["question"]>(null);
	const [selectedAnswerOptionId, setSelectedAnswerOptionId] = useState<
		string | null
	>(null);
	const [answer, setAnswer] = useState("");
	const [retryTranscript, setRetryTranscript] = useState<
		TaskShapingTranscriptEntry[] | null
	>(null);
	const [error, setError] = useState<string | null>(null);
	const sessionVersionRef = useRef(0);
	const availableDraftFields = TASK_SHAPING_DRAFT_FIELDS.filter(
		(field) => typeof drafts[field] === "string",
	);
	const staleDraftFields = getStaleTaskShapingDraftFields({
		drafts,
		sources: draftSources,
		values,
	});
	const staleDraftFieldSet = new Set(staleDraftFields);
	let latestAssistantMessage: string | null = null;
	for (let index = transcript.length - 1; index >= 0; index -= 1) {
		if (transcript[index].role === "assistant") {
			latestAssistantMessage = transcript[index].message;
			break;
		}
	}
	const selectedAnswerOption =
		activeQuestion?.answerOptions.find(
			(option) => option.identifier === selectedAnswerOptionId,
		) ?? null;
	const isCustomResponseSelected =
		selectedAnswerOption?.identifier ===
		TASK_SHAPING_CUSTOM_RESPONSE_OPTION_IDENTIFIER;
	const shouldShowAnswerTextarea = Boolean(
		activeQuestion && isCustomResponseSelected,
	);
	const canSendAnswer = Boolean(
		activeQuestion &&
			selectedAnswerOption &&
			(!isCustomResponseSelected || answer.trim()),
	);

	async function submitTurn({
		transcript: nextTranscript,
	}: {
		transcript: TaskShapingTranscriptEntry[];
	}) {
		if (isTurnLoading) {
			return;
		}

		const sessionVersion = sessionVersionRef.current;
		const sourceValues = {
			title: values.title,
			description: values.description,
			acceptanceCriteria: values.acceptanceCriteria,
		};

		setIsTurnLoading(true);
		setError(null);
		try {
			const turn = await startTaskShaping({
				projectId,
				drafts,
				transcript: nextTranscript,
				task: {
					title: blankToNull(values.title),
					description: blankToNull(values.description),
					acceptanceCriteria: blankToNull(values.acceptanceCriteria),
					priority: blankToNull(values.priority),
					storyPoints: values.storyPoints ? Number(values.storyPoints) : null,
					workflowColumn: workflowColumnName,
					mode,
				},
			});
			if (sessionVersionRef.current !== sessionVersion) {
				return;
			}

			const returnedDrafts = Object.fromEntries(
				Object.entries(turn.fieldDrafts).filter(([, value]) => Boolean(value)),
			) as TaskShapingFieldDrafts;
			setDrafts((current) => ({
				...current,
				...returnedDrafts,
			}));
			setDraftSources((current) => ({
				...current,
				...Object.fromEntries(
					TASK_SHAPING_DRAFT_FIELDS.filter(
						(field) => typeof returnedDrafts[field] === "string",
					).map((field) => [field, sourceValues[field]]),
				),
			}));
			setTranscript([
				...nextTranscript,
				{ role: "assistant", message: turn.assistantMessage },
			]);
			setActiveQuestion(turn.question ?? null);
			setSelectedAnswerOptionId(null);
			setRetryTranscript(null);
		} catch {
			if (sessionVersionRef.current !== sessionVersion) {
				return;
			}

			setRetryTranscript(nextTranscript);
			setError(
				"Task Shaping Chat could not complete this turn. Your answer, transcript, and drafts are still here.",
			);
		} finally {
			if (sessionVersionRef.current === sessionVersion) {
				setIsTurnLoading(false);
			}
		}
	}

	async function handleStart() {
		await submitTurn({ transcript });
	}

	async function handleSendAnswer() {
		const selectedResponseText = isCustomResponseSelected
			? answer.trim()
			: selectedAnswerOption?.responseText;
		const answerMessage = selectedResponseText ?? answer.trim();
		if (!activeQuestion || !answerMessage.trim() || isTurnLoading) {
			return;
		}

		const visibleTranscript = [...transcript];
		if (
			activeQuestion &&
			visibleTranscript[visibleTranscript.length - 1]?.message !==
				activeQuestion.text
		) {
			visibleTranscript.push({
				role: "assistant",
				message: activeQuestion.text,
			});
		}
		const nextTranscript: TaskShapingTranscriptEntry[] = [
			...visibleTranscript,
			{ role: "user", message: answerMessage },
		];
		setTranscript(nextTranscript);
		setAnswer("");
		setActiveQuestion(null);
		setSelectedAnswerOptionId(null);
		await submitTurn({ transcript: nextTranscript });
	}

	function applyDraft(field: TaskShapingDraftField) {
		draftApplication.applyDraft(field, drafts);
		onDraftApplied?.();
	}

	function applyAllDrafts() {
		draftApplication.applyAllDrafts(drafts);
		onDraftApplied?.();
	}

	function staleDraftWarning(field: TaskShapingDraftField) {
		return `This ${TASK_SHAPING_DRAFT_LABELS[field]} draft may be stale because ${TASK_SHAPING_DRAFT_LABELS[field]} changed after it was drafted. You can still apply it.`;
	}

	function resetChat() {
		sessionVersionRef.current += 1;
		setIsTurnLoading(false);
		setDrafts({});
		setDraftSources({});
		setTranscript([]);
		setActiveQuestion(null);
		setSelectedAnswerOptionId(null);
		setAnswer("");
		setRetryTranscript(null);
		setError(null);
	}

	return (
		<>
			<Button
				aria-expanded={isOpen}
				className="h-auto self-start rounded-full border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] shadow-none transition hover:bg-[var(--primary-container)]"
				type="button"
				onClick={() => setIsOpen((current) => !current)}
			>
				{isOpen ? "Close Task Shaping Chat" : "Task Shaping Chat"}
			</Button>

			{isOpen ? (
				<aside className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 shadow-[0_12px_28px_rgba(25,28,30,0.06)]">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<h3 className="text-sm font-bold text-[var(--on-surface)]">
								Task Shaping Chat
							</h3>
							<p className="mt-1 text-sm text-[var(--on-surface-variant)]">
								Start from the current form fields. Opening this drawer does not
								call AI.
							</p>
						</div>
						<div className="flex flex-wrap gap-2">
							<Button
								className="h-auto rounded-full border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] shadow-none transition hover:bg-[var(--primary-container)]"
								type="button"
								onClick={resetChat}
							>
								Reset chat
							</Button>
							<Button
								className="h-auto rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--on-primary)] shadow-none"
								disabled={isTurnLoading}
								type="button"
								onClick={() => void handleStart()}
							>
								{isTurnLoading && transcript.length === 0
									? "Starting..."
									: "Start shaping"}
							</Button>
						</div>
					</div>

					{transcript.length > 0 ? (
						<div className="mt-4 flex flex-col gap-2 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm leading-6 text-[var(--on-surface)]">
							<p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
								Transcript
							</p>
							{transcript.map((entry) => (
								<div key={`${entry.role}-${entry.message}`}>
									<p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--on-surface-variant)]">
										{entry.role === "assistant" ? "Assistant" : "You"}
									</p>
									<p>{entry.message}</p>
								</div>
							))}
							{isTurnLoading ? (
								<p className="font-semibold text-[var(--primary)]">
									Waiting for the next Task Shaping turn...
								</p>
							) : null}
						</div>
					) : null}

					{availableDraftFields.length > 0 ? (
						<div className="mt-4 flex flex-col gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm leading-6 text-[var(--on-surface)]">
							<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
								<p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
									Current drafts
								</p>
								<Button
									className="h-auto self-start rounded-full border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] shadow-none transition hover:bg-[var(--primary-container)] sm:self-auto"
									type="button"
									onClick={applyAllDrafts}
								>
									Apply all drafts
								</Button>
							</div>
							{staleDraftFields.length > 0 ? (
								<p className="rounded-lg border border-[var(--outline-variant)] bg-[var(--tertiary-container)] px-3 py-2 font-semibold text-[var(--on-tertiary-container)]">
									One or more drafts may be stale because the matching field
									changed after drafting. You can still apply stale drafts.
								</p>
							) : null}
							{availableDraftFields.map((field) => (
								<div key={field} className="flex flex-col gap-2">
									<p>
										<strong>{TASK_SHAPING_DRAFT_LABELS[field]}:</strong>{" "}
										{drafts[field]}
									</p>
									{staleDraftFieldSet.has(field) ? (
										<p className="rounded-lg border border-[var(--outline-variant)] bg-[var(--tertiary-container)] px-3 py-2 font-semibold text-[var(--on-tertiary-container)]">
											{staleDraftWarning(field)}
										</p>
									) : null}
									<Button
										className="h-auto self-start rounded-full border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] shadow-none transition hover:bg-[var(--primary-container)]"
										type="button"
										onClick={() => applyDraft(field)}
									>
										Apply {TASK_SHAPING_DRAFT_LABELS[field]} draft
									</Button>
								</div>
							))}
						</div>
					) : null}

					{activeQuestion ? (
						<fieldset className="mt-4 flex flex-col gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm leading-6 text-[var(--on-surface)]">
							<legend className="px-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
								Answer options
							</legend>
							{activeQuestion.text !== latestAssistantMessage ? (
								<p className="font-semibold">{activeQuestion.text}</p>
							) : null}
							<div className="flex flex-col gap-2" role="radiogroup">
								{activeQuestion.answerOptions.map((option) => (
									<label
										className="flex cursor-pointer gap-3 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 transition hover:bg-[var(--primary-container)]"
										key={option.identifier}
									>
										<input
											checked={selectedAnswerOptionId === option.identifier}
											className="mt-1"
											name="taskShapingAnswerOption"
											type="radio"
											value={option.identifier}
											onChange={() => {
												setSelectedAnswerOptionId(option.identifier);
											}}
										/>
										<span>
											<span className="font-semibold">{option.label}</span>
											{option.isRecommended ? (
												<span className="ml-2 rounded-full bg-[var(--primary-container)] px-2 py-0.5 text-xs font-bold text-[var(--on-primary-container)]">
													Recommended
												</span>
											) : null}
											<span className="block text-[var(--on-surface-variant)]">
												{option.detail || option.responseText}
											</span>
										</span>
									</label>
								))}
							</div>
						</fieldset>
					) : null}

					{activeQuestion || retryTranscript ? (
						<div className="mt-4 flex flex-col gap-3">
							{shouldShowAnswerTextarea ? (
								<Field>
									<FieldLabel
										className="text-sm font-semibold text-[var(--on-surface)]"
										htmlFor="taskShapingAnswer"
									>
										Answer the focused question
									</FieldLabel>
									<Textarea
										id="taskShapingAnswer"
										name="taskShapingAnswer"
										placeholder="Type a short answer."
										rows={3}
										value={answer}
										onChange={(event) => setAnswer(event.target.value)}
									/>
								</Field>
							) : null}
							<div className="flex flex-wrap gap-2">
								{activeQuestion ? (
									<Button
										className="h-auto rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--on-primary)] shadow-none"
										disabled={isTurnLoading || !canSendAnswer}
										type="button"
										onClick={() => void handleSendAnswer()}
									>
										{isTurnLoading ? "Sending..." : "Send answer"}
									</Button>
								) : null}
								{retryTranscript ? (
									<Button
										className="h-auto rounded-full border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] shadow-none transition hover:bg-[var(--primary-container)]"
										disabled={isTurnLoading}
										type="button"
										onClick={() =>
											void submitTurn({ transcript: retryTranscript })
										}
									>
										Retry turn
									</Button>
								) : null}
							</div>
						</div>
					) : null}
					{error ? (
						<p className="mt-4 rounded-xl border border-[var(--outline-variant)] bg-[var(--error-container)] px-4 py-3 text-sm font-semibold text-[var(--on-error-container)]">
							{error}
						</p>
					) : null}
				</aside>
			) : null}
		</>
	);
}
