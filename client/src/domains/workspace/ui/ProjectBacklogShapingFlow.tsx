import { useMemo, useState } from "react";

import {
	generateProjectTaskDrafts,
	type ProjectTaskShapingTranscriptEntry,
	startProjectTaskShaping,
	type Task,
	useKanaiApi,
} from "#/api/client";
import { Textarea } from "#/components/ui/textarea";
import {
	areProjectTaskDraftsStale,
	createEditableProjectTaskDrafts,
	type EditableProjectTaskDraft,
	getProjectBacklogGraph,
	validateProjectTaskDrafts,
} from "#/domains/workspace/model/projectBacklogShaping";

const MAX_SHAPING_TRANSCRIPT_ENTRIES = 20;

function blankToNull(value: string): string | null {
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

function latestTranscript(entries: ProjectTaskShapingTranscriptEntry[]) {
	return entries.slice(-MAX_SHAPING_TRANSCRIPT_ENTRIES);
}

function keyedTranscript(entries: ProjectTaskShapingTranscriptEntry[]) {
	const seen = new Map<string, number>();
	return entries.map((entry) => {
		const baseKey = `${entry.role}-${entry.message}`;
		const count = seen.get(baseKey) ?? 0;
		seen.set(baseKey, count + 1);
		return { entry, key: `${baseKey}-${count}` };
	});
}

export function ProjectBacklogShapingFlow({
	existingBacklogTasks,
	projectId,
	onSaved,
}: {
	existingBacklogTasks: Task[];
	projectId: string;
	onSaved: () => void;
}) {
	const api = useKanaiApi();
	const [idea, setIdea] = useState("");
	const [answer, setAnswer] = useState("");
	const [transcript, setTranscript] = useState<
		ProjectTaskShapingTranscriptEntry[]
	>([]);
	const [question, setQuestion] = useState<string | null>(null);
	const [sharedUnderstanding, setSharedUnderstanding] = useState("");
	const [drafts, setDrafts] = useState<EditableProjectTaskDraft[]>([]);
	const [generatedFrom, setGeneratedFrom] = useState<string | null>(null);
	const [pending, setPending] = useState<
		"interview" | "drafts" | "save" | null
	>(null);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	const stale = areProjectTaskDraftsStale({
		generatedFrom,
		sharedUnderstanding,
	});
	const validation = validateProjectTaskDrafts(drafts, existingBacklogTasks);
	const graph = useMemo(
		() => getProjectBacklogGraph(drafts, existingBacklogTasks),
		[drafts, existingBacklogTasks],
	);
	const canSave =
		drafts.length > 0 &&
		validation.canSave &&
		!stale &&
		!saved &&
		pending === null;

	async function interview(message: string | null) {
		if (pending) {
			return;
		}
		const nextTranscript = latestTranscript(
			message
				? [...transcript, { role: "user" as const, message }]
				: transcript,
		);
		setPending("interview");
		setError(null);
		try {
			const output = await startProjectTaskShaping({
				projectId,
				idea,
				transcript: nextTranscript,
			});
			setTranscript(
				latestTranscript([
					...nextTranscript,
					{ role: "assistant", message: output.assistantMessage },
				]),
			);
			setQuestion(output.question?.text ?? null);
			if (output.sharedUnderstanding) {
				setSharedUnderstanding(output.sharedUnderstanding);
			}
			setAnswer("");
		} catch {
			setError(
				"Project shaping could not complete this turn. Your edits are still here.",
			);
		} finally {
			setPending(null);
		}
	}

	async function generateDrafts() {
		if (pending || !sharedUnderstanding.trim()) {
			return;
		}
		setPending("drafts");
		setError(null);
		try {
			const output = await generateProjectTaskDrafts({
				projectId,
				sharedUnderstanding,
				transcript: latestTranscript(transcript),
			});
			setTranscript(
				latestTranscript([
					...transcript,
					{ role: "assistant", message: output.assistantMessage },
				]),
			);
			setDrafts(createEditableProjectTaskDrafts(output.drafts));
			setGeneratedFrom(sharedUnderstanding);
			setSaved(false);
		} catch {
			setError(
				"Draft generation failed. Your shared understanding and edits are still here.",
			);
		} finally {
			setPending(null);
		}
	}

	async function saveDrafts() {
		if (!canSave) {
			return;
		}
		setPending("save");
		setError(null);
		try {
			await api.backlog.bulkCreateTasks(projectId, {
				tasks: drafts.map((draft) => ({
					key: draft.key,
					title: draft.title.trim(),
					description: blankToNull(draft.description ?? ""),
					acceptanceCriteria: blankToNull(draft.acceptanceCriteria ?? ""),
					priority: draft.priority ?? null,
					storyPoints: draft.storyPoints ?? null,
					assigneeId: draft.assigneeId ?? null,
					tag: draft.tag ?? null,
					prerequisites: draft.prerequisites,
				})),
			});
			setSaved(true);
			onSaved();
		} catch {
			setError(
				"Backlog drafts could not be saved. Your reviewed drafts are still here.",
			);
		} finally {
			setPending(null);
		}
	}

	function updateDraft(key: string, patch: Partial<EditableProjectTaskDraft>) {
		setDrafts((current) =>
			current.map((draft) =>
				draft.key === key ? { ...draft, ...patch } : draft,
			),
		);
		setSaved(false);
	}

	function togglePrerequisite(
		draft: EditableProjectTaskDraft,
		value: string,
		checked: boolean,
	) {
		const prerequisite = value.startsWith("draft:")
			? { type: "draft" as const, key: value.slice(6) }
			: { type: "existing" as const, taskId: value.slice(9) };
		const same = (item: typeof prerequisite) =>
			item.type === prerequisite.type &&
			(item.type === "draft"
				? item.key === prerequisite.key
				: item.taskId === prerequisite.taskId);
		updateDraft(draft.key, {
			prerequisites: checked
				? [...draft.prerequisites, prerequisite]
				: draft.prerequisites.filter(
						(item) => !same(item as typeof prerequisite),
					),
		});
	}

	return (
		<div className="mt-5 rounded-[1.5rem] border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h4 className="text-lg font-bold">Shape project idea</h4>
					<p className="mt-1 text-sm text-[var(--on-surface-variant)]">
						Interview, review shared understanding, then save reviewed Backlog
						tasks.
					</p>
				</div>
				{saved ? (
					<p className="text-sm font-semibold text-[var(--primary)]">
						Saved to Backlog.
					</p>
				) : null}
			</div>

			<label
				className="mt-4 grid gap-2 text-sm font-semibold"
				htmlFor="project-backlog-shaping-idea"
			>
				Project idea
			</label>
			<Textarea
				id="project-backlog-shaping-idea"
				value={idea}
				onChange={(event) => setIdea(event.currentTarget.value)}
				placeholder="Describe the broad project idea."
			/>
			<div className="mt-3 flex flex-wrap gap-2">
				<button
					type="button"
					disabled={pending !== null || !idea.trim()}
					onClick={() => void interview(null)}
					className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-bold text-[color:var(--on-primary)] disabled:cursor-not-allowed disabled:opacity-50"
				>
					{pending === "interview" && transcript.length === 0
						? "Starting..."
						: "Start interview"}
				</button>
			</div>

			{transcript.length > 0 ? (
				<div className="mt-4 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3 text-sm">
					<p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
						Transcript
					</p>
					{keyedTranscript(transcript).map(({ entry, key }) => (
						<p key={key} className="mt-2">
							<strong>
								{entry.role === "assistant" ? "Assistant" : "You"}:
							</strong>{" "}
							{entry.message}
						</p>
					))}
				</div>
			) : null}

			{question ? (
				<div className="mt-4 grid gap-2">
					<p className="text-sm font-semibold">{question}</p>
					<Textarea
						value={answer}
						onChange={(event) => setAnswer(event.currentTarget.value)}
						placeholder="Answer the focused question."
					/>
					<button
						type="button"
						disabled={pending !== null || !answer.trim()}
						onClick={() => void interview(answer.trim())}
						className="w-fit rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-bold text-[color:var(--on-primary)] disabled:cursor-not-allowed disabled:opacity-50"
					>
						Send answer
					</button>
				</div>
			) : null}

			<label
				className="mt-4 grid gap-2 text-sm font-semibold"
				htmlFor="project-backlog-shaping-understanding"
			>
				Shared understanding
			</label>
			<Textarea
				id="project-backlog-shaping-understanding"
				value={sharedUnderstanding}
				onChange={(event) => {
					setSharedUnderstanding(event.currentTarget.value);
					setSaved(false);
				}}
				placeholder="Review or write the shared understanding before generating drafts."
				rows={5}
			/>
			<div className="mt-3 flex flex-wrap items-center gap-2">
				<button
					type="button"
					disabled={pending !== null || !sharedUnderstanding.trim()}
					onClick={() => void generateDrafts()}
					className="rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-2 text-sm font-bold hover:bg-[var(--surface-bright)] disabled:cursor-not-allowed disabled:opacity-50"
				>
					{pending === "drafts" ? "Generating..." : "Generate drafts"}
				</button>
				{stale ? (
					<span className="text-sm font-semibold text-[var(--error)]">
						Drafts are stale. Regenerate before saving.
					</span>
				) : null}
			</div>

			{drafts.length > 0 ? (
				<div className="mt-5 grid gap-4">
					{drafts.map((draft) => {
						const selected = new Set(
							draft.prerequisites.map((item) =>
								item.type === "draft"
									? `draft:${item.key}`
									: `existing:${item.taskId}`,
							),
						);
						return (
							<article
								key={draft.key}
								className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4"
							>
								<label className="grid gap-1 text-sm font-semibold">
									Title
									<input
										value={draft.title}
										onChange={(event) =>
											updateDraft(draft.key, {
												title: event.currentTarget.value,
											})
										}
										className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2"
									/>
								</label>
								<label
									className="mt-3 grid gap-1 text-sm font-semibold"
									htmlFor={`${draft.key}-description`}
								>
									Description
								</label>
								<Textarea
									id={`${draft.key}-description`}
									value={draft.description ?? ""}
									onChange={(event) =>
										updateDraft(draft.key, {
											description: event.currentTarget.value,
										})
									}
								/>
								<label
									className="mt-3 grid gap-1 text-sm font-semibold"
									htmlFor={`${draft.key}-acceptance-criteria`}
								>
									Acceptance criteria
								</label>
								<Textarea
									id={`${draft.key}-acceptance-criteria`}
									value={draft.acceptanceCriteria ?? ""}
									onChange={(event) =>
										updateDraft(draft.key, {
											acceptanceCriteria: event.currentTarget.value,
										})
									}
								/>
								<fieldset className="mt-3 grid gap-2 rounded-xl border border-[var(--outline-variant)] p-3 text-sm">
									<legend className="px-1 font-bold">Prerequisites</legend>
									{drafts
										.filter((other) => other.key !== draft.key)
										.map((other) => (
											<label key={other.key} className="flex gap-2">
												<input
													type="checkbox"
													checked={selected.has(`draft:${other.key}`)}
													onChange={(event) =>
														togglePrerequisite(
															draft,
															`draft:${other.key}`,
															event.currentTarget.checked,
														)
													}
												/>{" "}
												Draft: {other.title || other.key}
											</label>
										))}
									{existingBacklogTasks.map((task) => (
										<label key={task.id} className="flex gap-2">
											<input
												type="checkbox"
												checked={selected.has(`existing:${task.id}`)}
												onChange={(event) =>
													togglePrerequisite(
														draft,
														`existing:${task.id}`,
														event.currentTarget.checked,
													)
												}
											/>{" "}
											Existing: {task.title}
										</label>
									))}
									{drafts.length <= 1 && existingBacklogTasks.length === 0 ? (
										<p className="text-[var(--on-surface-variant)]">
											No prerequisite options.
										</p>
									) : null}
								</fieldset>
								{validation.errorsByKey[draft.key]?.map((message) => (
									<p
										key={message}
										className="mt-2 text-sm font-semibold text-[var(--error)]"
									>
										{message}
									</p>
								))}
							</article>
						);
					})}
					<div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4">
						<h5 className="font-bold">Dependency graph</h5>
						{graph.edges.length === 0 ? (
							<p className="mt-2 text-sm text-[var(--on-surface-variant)]">
								No selected dependencies.
							</p>
						) : (
							<ul className="mt-2 list-disc pl-5 text-sm">
								{graph.edges.map((edge) => (
									<li key={`${edge.from}-${edge.to}`}>{edge.label}</li>
								))}
							</ul>
						)}
						<svg
							className="mt-3 h-24 w-full rounded-xl bg-[var(--surface-container-low)]"
							role="img"
							aria-label="Selected direct dependencies"
						>
							{graph.edges.map((edge, index) => (
								<text
									key={`${edge.from}-${edge.to}`}
									x="12"
									y={24 + index * 18}
									className="fill-[var(--on-surface)] text-xs"
								>
									{edge.label}
								</text>
							))}
						</svg>
					</div>
					<button
						type="button"
						disabled={!canSave}
						onClick={() => void saveDrafts()}
						className="w-fit rounded-full bg-[var(--primary)] px-5 py-2 text-sm font-bold text-[color:var(--on-primary)] disabled:cursor-not-allowed disabled:opacity-50"
					>
						{pending === "save" ? "Saving..." : "Save reviewed drafts"}
					</button>
				</div>
			) : null}

			{error ? (
				<p
					role="alert"
					className="mt-4 rounded-xl bg-[var(--error-container)] px-4 py-3 text-sm font-semibold text-[var(--on-error-container)]"
				>
					{error}
				</p>
			) : null}
		</div>
	);
}
