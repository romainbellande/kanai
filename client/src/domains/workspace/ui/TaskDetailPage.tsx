import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { type FormEvent, useState } from "react";

import { useKanaiApi } from "#/api/client";
import { Button } from "#/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "#/components/ui/native-select";
import { Textarea } from "#/components/ui/textarea";
import {
	STORY_POINT_OPTIONS,
	useTaskForm,
} from "#/domains/workspace/model/useTaskForm";
import { TaskShapingChat } from "#/domains/workspace/ui/TaskShapingChat";
import { WorkspaceLayout } from "#/domains/workspace/ui/templates/WorkspaceLayout";

export function TaskDetailPage({
	fromBacklog = false,
}: {
	fromBacklog?: boolean;
}) {
	const { projectId, taskId } = useParams({
		from: "/projects_/$projectId/tasks/$taskId",
	});
	const api = useKanaiApi();
	const projectQuery = useQuery(api.projects.get(projectId));
	const columnsQuery = useQuery(api.projectColumns.list(projectId));
	const tasksQuery = useQuery(api.tasks.list(projectId));
	const task = tasksQuery.data?.find((item) => item.id === taskId) ?? null;
	const [savedMessage, setSavedMessage] = useState<string | null>(null);
	const form = useTaskForm({
		projectId,
		mode: "edit",
		taskId,
		task,
		workflowColumns: columnsQuery.data,
		isWorkflowLoading: columnsQuery.isLoading,
		onSaved: () => setSavedMessage("Task changes saved."),
	});
	const projectName = projectQuery.data?.name ?? "Project";
	const workflowMessage = columnsQuery.isError
		? "Project workflow columns could not be loaded."
		: form.workflowState.message;
	const returnTo = fromBacklog
		? "/projects/$projectId/backlog"
		: "/projects/$projectId";
	const returnLabel = fromBacklog ? "Back to the Backlog" : "Back to Board";

	function updateField(field: keyof typeof form.values, value: string) {
		form.setField(field, value);
		setSavedMessage(null);
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSavedMessage(null);
		await form.submit();
	}

	function handleGenerateAcceptanceCriteria() {
		if (form.acceptanceCriteriaGeneration.isGenerating) {
			form.acceptanceCriteriaGeneration.cancel();
			return;
		}

		setSavedMessage(null);
		void form.acceptanceCriteriaGeneration.generate();
	}

	function handleTaskShapingDraftApplied() {
		setSavedMessage(null);
	}

	return (
		<WorkspaceLayout
			breadcrumbItems={[
				{ label: "Projects", to: "/" },
				{
					label: projectName,
					to: "/projects/$projectId",
					params: { projectId },
				},
				{ label: task?.title ?? "Task" },
			]}
			contentContainerClassName="mx-auto flex w-full max-w-[820px] flex-col gap-8"
			contentClassName="px-4 py-8 pb-12 sm:px-6 lg:px-8"
			pageDescription="Inspect the selected task, update its planning fields, and keep the board in sync."
			pageTitle={task?.title ?? "Task Details"}
			sectionClassName="lg:min-h-screen"
		>
			<section className="rise-in rounded-[1.75rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_50%,transparent)] bg-[var(--surface-container-lowest)] p-6 shadow-[0_18px_42px_rgba(25,28,30,0.04)] sm:p-10">
				{projectQuery.isError ? (
					<p className="mb-6 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm text-[var(--on-surface-variant)]">
						Project details could not be loaded, but you can still edit this
						task.
					</p>
				) : null}

				{tasksQuery.isPending ? (
					<p className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm text-[var(--on-surface-variant)]">
						Loading task details...
					</p>
				) : null}

				{tasksQuery.isError ? (
					<div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm text-[var(--on-surface-variant)]">
						Task details could not be loaded.
						<button
							type="button"
							onClick={() => void tasksQuery.refetch()}
							className="ml-3 rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--on-primary)]"
						>
							Retry
						</button>
					</div>
				) : null}

				{!tasksQuery.isPending && !tasksQuery.isError && !task ? (
					<div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm text-[var(--on-surface-variant)]">
						This task could not be found.
						<Link
							to={returnTo}
							params={{ projectId }}
							className="ml-3 font-semibold text-[var(--primary)] no-underline hover:underline"
						>
							{returnLabel}
						</Link>
					</div>
				) : null}

				{task ? (
					<form className="flex flex-col gap-8" onSubmit={handleSubmit}>
						<section className="grid grid-cols-1 gap-5 sm:grid-cols-2">
							<div className="sm:col-span-2">
								<h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--primary)]">
									Task Details
								</h2>
								<p className="mt-1 text-sm text-[var(--on-surface-variant)]">
									Update the visible task fields. Empty notes are saved as blank
									values.
								</p>
							</div>

							<Field className="sm:col-span-2">
								<FieldLabel
									className="text-sm font-semibold text-[var(--on-surface)]"
									htmlFor="taskTitle"
								>
									Task Title
								</FieldLabel>
								<Input
									id="taskTitle"
									onChange={(event) => updateField("title", event.target.value)}
									required
									type="text"
									value={form.values.title}
								/>
							</Field>
						</section>

						<section className="grid grid-cols-1 gap-5 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4 sm:grid-cols-2 sm:p-5">
							<div className="sm:col-span-2">
								<h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--primary)]">
									Planning
								</h2>
								<p className="mt-1 text-sm text-[var(--on-surface-variant)]">
									Changes to status and priority are reflected on the board
									after save.
								</p>
							</div>

							<Field>
								<FieldLabel
									className="text-sm font-semibold text-[var(--on-surface)]"
									htmlFor="taskStatus"
								>
									Workflow
								</FieldLabel>
								<NativeSelect
									id="taskStatus"
									disabled={
										form.workflowState.isBlocked || columnsQuery.isError
									}
									onChange={(event) =>
										updateField("status", event.target.value)
									}
									value={form.values.status}
								>
									{columnsQuery.data?.map((column) => (
										<NativeSelectOption key={column.id} value={column.id}>
											{column.name}
										</NativeSelectOption>
									))}
								</NativeSelect>
								{workflowMessage ? (
									<FieldDescription className="text-sm font-medium text-[var(--on-surface-variant)]">
										{workflowMessage}
									</FieldDescription>
								) : null}
							</Field>

							<Field>
								<FieldLabel
									className="text-sm font-semibold text-[var(--on-surface)]"
									htmlFor="taskPriority"
								>
									Priority
								</FieldLabel>
								<NativeSelect
									id="taskPriority"
									onChange={(event) =>
										updateField("priority", event.target.value)
									}
									value={form.values.priority}
								>
									<NativeSelectOption value="">No priority</NativeSelectOption>
									<NativeSelectOption value="low">Low</NativeSelectOption>
									<NativeSelectOption value="medium">Medium</NativeSelectOption>
									<NativeSelectOption value="high">High</NativeSelectOption>
									<NativeSelectOption value="critical">
										Critical
									</NativeSelectOption>
								</NativeSelect>
							</Field>

							<Field>
								<FieldLabel
									className="text-sm font-semibold text-[var(--on-surface)]"
									htmlFor="taskStoryPoints"
								>
									Story Points
								</FieldLabel>
								<NativeSelect
									id="taskStoryPoints"
									onChange={(event) =>
										updateField("storyPoints", event.target.value)
									}
									value={form.values.storyPoints}
								>
									<NativeSelectOption value="">
										No estimation
									</NativeSelectOption>
									{STORY_POINT_OPTIONS.map((points) => (
										<NativeSelectOption key={points} value={points.toString()}>
											{points}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Field>

							<Field className="sm:col-span-2">
								<FieldLabel
									className="text-sm font-semibold text-[var(--on-surface)]"
									htmlFor="taskTag"
								>
									Tag
								</FieldLabel>
								<Input
									id="taskTag"
									onChange={(event) => updateField("tag", event.target.value)}
									placeholder="Optional label shown on the card"
									type="text"
									value={form.values.tag}
								/>
							</Field>
						</section>

						<section className="grid grid-cols-1 gap-5">
							<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
								<div>
									<h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--primary)]">
										Work Notes
									</h2>
									<p className="mt-1 text-sm text-[var(--on-surface-variant)]">
										Keep context and completion criteria available from the task
										view.
									</p>
								</div>
							</div>

							<TaskShapingChat
								projectId={projectId}
								mode="edit"
								values={form.values}
								workflowColumnName={
									columnsQuery.data?.find(
										(column) =>
											column.id === form.workflowState.selectedColumnId,
									)?.name ?? null
								}
								draftApplication={form.taskShapingDraftApplication}
								onDraftApplied={handleTaskShapingDraftApplied}
							/>

							<Field>
								<FieldLabel
									className="text-sm font-semibold text-[var(--on-surface)]"
									htmlFor="taskDescription"
								>
									Description
								</FieldLabel>
								<Textarea
									id="taskDescription"
									onChange={(event) =>
										updateField("description", event.target.value)
									}
									placeholder="Add context, background, or handoff notes..."
									rows={5}
									value={form.values.description}
								/>
							</Field>

							<Field>
								<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
									<FieldLabel
										className="text-sm font-semibold text-[var(--on-surface)]"
										htmlFor="taskAcceptanceCriteria"
									>
										Acceptance Criteria
									</FieldLabel>
									<Button
										className="h-auto self-start rounded-full border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] shadow-none transition hover:bg-[var(--primary-container)] sm:self-auto"
										disabled={
											!form.acceptanceCriteriaGeneration.canGenerate &&
											!form.acceptanceCriteriaGeneration.isGenerating
										}
										type="button"
										onClick={handleGenerateAcceptanceCriteria}
									>
										{form.acceptanceCriteriaGeneration.isGenerating
											? "Cancel generation"
											: "Generate with AI"}
									</Button>
								</div>
								<Textarea
									id="taskAcceptanceCriteria"
									disabled={form.acceptanceCriteriaGeneration.isGenerating}
									onChange={(event) =>
										updateField("acceptanceCriteria", event.target.value)
									}
									placeholder="List the conditions that must be met for this task to be complete..."
									rows={4}
									value={form.values.acceptanceCriteria}
								/>
								{form.acceptanceCriteriaGeneration.message ? (
									<FieldDescription className="text-sm font-medium text-[var(--on-surface-variant)]">
										{form.acceptanceCriteriaGeneration.message}
									</FieldDescription>
								) : null}
							</Field>
						</section>

						{form.errorMessage ? (
							<p className="rounded-xl border border-[var(--outline-variant)] bg-[var(--error-container)] px-4 py-3 text-sm font-semibold text-[var(--on-error-container)]">
								{form.errorMessage}
							</p>
						) : null}

						{savedMessage ? (
							<p className="rounded-xl border border-[var(--outline-variant)] bg-[var(--primary-fixed)] px-4 py-3 text-sm font-semibold text-[var(--on-primary-fixed)]">
								{savedMessage}
							</p>
						) : null}

						<div className="flex flex-col-reverse gap-3 border-t border-[var(--outline-variant)] pt-6 sm:flex-row sm:items-center sm:justify-end">
							<Link
								to={returnTo}
								params={{ projectId }}
								className="inline-flex items-center justify-center rounded-full border border-transparent px-5 py-2.5 text-sm font-semibold text-[var(--on-surface-variant)] no-underline transition hover:border-[var(--outline-variant)] hover:bg-[var(--surface-bright)]"
							>
								{returnLabel}
							</Link>
							<Button
								disabled={
									form.isSaving ||
									form.workflowState.isBlocked ||
									columnsQuery.isError
								}
								type="submit"
								className="h-auto rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[color:var(--on-primary)] shadow-[0_12px_28px_rgba(0,61,155,0.18)] transition hover:bg-[var(--primary-container)]"
							>
								<Save data-icon="inline-start" />
								{form.isSaving ? "Saving..." : "Save Changes"}
							</Button>
						</div>
					</form>
				) : null}
			</section>
		</WorkspaceLayout>
	);
}
