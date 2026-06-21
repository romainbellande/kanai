import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { CirclePlus } from "lucide-react";
import type { FormEvent } from "react";

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
import { TaskPrerequisitesField } from "#/domains/workspace/ui/TaskPrerequisitesField";
import { TaskShapingChat } from "#/domains/workspace/ui/TaskShapingChat";
import { WorkspaceLayout } from "#/domains/workspace/ui/templates/WorkspaceLayout";

export function CreateTaskPage({
	createInBacklog = false,
	includeInActiveSprint = false,
	initialColumnId,
}: {
	createInBacklog?: boolean;
	includeInActiveSprint?: boolean;
	initialColumnId?: string;
}) {
	const { projectId } = useParams({ from: "/projects_/$projectId/tasks/new" });
	const navigate = useNavigate();
	const api = useKanaiApi();
	const projectQuery = useQuery(api.projects.get(projectId));
	const columnsQuery = useQuery(api.projectColumns.list(projectId));
	const doneColumnQuery = useQuery(api.doneColumn.get(projectId));
	const needsNonDoneDefaultColumn = createInBacklog || includeInActiveSprint;
	const doneColumnId = doneColumnQuery.data?.doneColumnId;
	const defaultColumnId =
		needsNonDoneDefaultColumn && !initialColumnId && doneColumnId
			? columnsQuery.data?.find((column) => column.id !== doneColumnId)?.id
			: undefined;
	const workflowColumnsUnavailable =
		columnsQuery.isError || (createInBacklog && doneColumnQuery.isError);
	const form = useTaskForm({
		projectId,
		mode: "create",
		createInBacklog,
		includeInActiveSprint,
		initialColumnId,
		defaultColumnId,
		requireDefaultColumn: createInBacklog,
		defaultColumnMissingMessage:
			"A non-Done workflow column is required before creating Backlog tasks.",
		workflowColumns: workflowColumnsUnavailable ? undefined : columnsQuery.data,
		isWorkflowLoading:
			columnsQuery.isLoading ||
			(needsNonDoneDefaultColumn && doneColumnQuery.isLoading),
		onSaved: () => {
			void navigate({
				to: createInBacklog
					? "/projects/$projectId/backlog"
					: "/projects/$projectId",
				params: { projectId },
			});
		},
	});
	const projectName = projectQuery.data?.name ?? "Project";
	const workflowMessage = workflowColumnsUnavailable
		? "Project workflow columns could not be loaded."
		: form.workflowState.message;
	const pageTitle = createInBacklog
		? "Create Backlog Task"
		: includeInActiveSprint
			? "Create Current Sprint Task"
			: "Create New Task";
	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		await form.submit();
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
				{ label: "New Task" },
			]}
			contentContainerClassName="mx-auto flex w-full max-w-[760px] flex-col gap-8"
			contentClassName="px-4 py-8 pb-12 sm:px-6 lg:px-8"
			pageDescription="Capture the work item and assign the details needed to move it forward."
			pageTitle={pageTitle}
			sectionClassName="lg:min-h-screen"
		>
			<section className="rise-in rounded-[1.75rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_50%,transparent)] bg-[var(--surface-container-lowest)] p-6 shadow-[0_18px_42px_rgba(25,28,30,0.04)] sm:p-10">
				{projectQuery.isError ? (
					<p className="mb-6 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm text-[var(--on-surface-variant)]">
						Project details could not be loaded, but you can still create a task
						for this project ID.
					</p>
				) : null}
				<form className="flex flex-col gap-8" onSubmit={handleSubmit}>
					<div className="flex flex-col gap-8">
						<section className="grid grid-cols-1 gap-5 sm:grid-cols-2">
							<div className="sm:col-span-2">
								<h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--primary)]">
									Task Details
								</h2>
								<p className="mt-1 text-sm text-[var(--on-surface-variant)]">
									Name the work item before assigning ownership and priority.
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
									name="taskTitle"
									placeholder="e.g., Finalize launch readiness checklist"
									required
									type="text"
									value={form.values.title}
									onChange={(event) =>
										form.setField("title", event.target.value)
									}
								/>
							</Field>
						</section>

						<section className="grid grid-cols-1 gap-5 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4 sm:grid-cols-2 sm:p-5">
							<div className="sm:col-span-2">
								<h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--primary)]">
									Planning
								</h2>
								<p className="mt-1 text-sm text-[var(--on-surface-variant)]">
									Set the workflow state, urgency, and assignee in one pass.
								</p>
							</div>

							{createInBacklog ? (
								<Field>
									<p className="mb-2 block text-sm font-semibold text-[var(--on-surface)]">
										Destination
									</p>
									<div className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-base font-semibold text-[var(--on-surface)]">
										Backlog
									</div>
									{workflowMessage ? (
										<FieldDescription className="text-sm font-medium text-[var(--on-surface-variant)]">
											{workflowMessage}
										</FieldDescription>
									) : null}
								</Field>
							) : (
								<Field>
									<FieldLabel
										className="text-sm font-semibold text-[var(--on-surface)]"
										htmlFor="taskStatus"
									>
										Workflow
									</FieldLabel>
									<NativeSelect
										id="taskStatus"
										name="taskStatus"
										disabled={
											form.workflowState.isBlocked || columnsQuery.isError
										}
										value={form.values.status}
										onChange={(event) =>
											form.setField("status", event.target.value)
										}
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
							)}

							<Field>
								<FieldLabel
									className="text-sm font-semibold text-[var(--on-surface)]"
									htmlFor="taskPriority"
								>
									Priority
								</FieldLabel>
								<NativeSelect
									id="taskPriority"
									name="taskPriority"
									value={form.values.priority}
									onChange={(event) =>
										form.setField("priority", event.target.value)
									}
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
									name="taskStoryPoints"
									value={form.values.storyPoints}
									onChange={(event) =>
										form.setField("storyPoints", event.target.value)
									}
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
									name="taskTag"
									placeholder="Optional label shown on the card"
									type="text"
									value={form.values.tag}
									onChange={(event) => form.setField("tag", event.target.value)}
								/>
							</Field>

							<TaskPrerequisitesField
								columns={columnsQuery.data}
								onChange={form.setPrerequisiteTaskIds}
								projectId={projectId}
								selectedTaskIds={form.values.prerequisiteTaskIds}
							/>

							<div className="sm:col-span-2 rounded-2xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 text-sm leading-6 text-[var(--on-surface-variant)]">
								Assignees are not editable until the user directory API is
								available. This task will be created without an assignee.
							</div>
						</section>

						<section className="grid grid-cols-1 gap-5">
							<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
								<div>
									<h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--primary)]">
										Work Notes
									</h2>
									<p className="mt-1 text-sm text-[var(--on-surface-variant)]">
										Separate background context from the conditions required to
										finish.
									</p>
								</div>
							</div>

							<TaskShapingChat
								projectId={projectId}
								mode="create"
								values={form.values}
								workflowColumnName={
									columnsQuery.data?.find(
										(column) =>
											column.id === form.workflowState.selectedColumnId,
									)?.name ?? null
								}
								draftApplication={form.taskShapingDraftApplication}
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
									name="taskDescription"
									placeholder="Add context, background, or handoff notes..."
									rows={5}
									value={form.values.description}
									onChange={(event) =>
										form.setField("description", event.target.value)
									}
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
										onClick={() => {
											if (form.acceptanceCriteriaGeneration.isGenerating) {
												form.acceptanceCriteriaGeneration.cancel();
												return;
											}

											void form.acceptanceCriteriaGeneration.generate();
										}}
									>
										{form.acceptanceCriteriaGeneration.isGenerating
											? "Cancel generation"
											: "Generate with AI"}
									</Button>
								</div>
								<Textarea
									id="taskAcceptanceCriteria"
									name="taskAcceptanceCriteria"
									disabled={form.acceptanceCriteriaGeneration.isGenerating}
									placeholder="List the conditions that must be met for this task to be complete..."
									rows={4}
									value={form.values.acceptanceCriteria}
									onChange={(event) =>
										form.setField("acceptanceCriteria", event.target.value)
									}
								/>
								{form.acceptanceCriteriaGeneration.message ? (
									<FieldDescription className="text-sm font-medium text-[var(--on-surface-variant)]">
										{form.acceptanceCriteriaGeneration.message}
									</FieldDescription>
								) : null}
							</Field>
						</section>
					</div>

					{form.errorMessage ? (
						<p className="rounded-xl border border-[var(--outline-variant)] bg-[var(--error-container)] px-4 py-3 text-sm font-semibold text-[var(--on-error-container)]">
							{form.errorMessage}
						</p>
					) : null}

					<div className="flex flex-col-reverse gap-3 border-t border-[var(--outline-variant)] pt-6 sm:flex-row sm:items-center sm:justify-end">
						<Link
							to={
								createInBacklog
									? "/projects/$projectId/backlog"
									: "/projects/$projectId"
							}
							params={{ projectId }}
							className="inline-flex items-center justify-center rounded-full border border-transparent px-5 py-2.5 text-sm font-semibold text-[var(--on-surface-variant)] no-underline transition hover:border-[var(--outline-variant)] hover:bg-[var(--surface-bright)]"
						>
							Cancel
						</Link>
						<Button
							disabled={
								form.isSaving ||
								form.workflowState.isBlocked ||
								workflowColumnsUnavailable
							}
							type="submit"
							className="h-auto rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[color:var(--on-primary)] shadow-[0_12px_28px_rgba(0,61,155,0.18)] transition hover:bg-[var(--primary-container)]"
						>
							<CirclePlus data-icon="inline-start" />
							{form.isSaving ? "Creating..." : "Create Task"}
						</Button>
					</div>
				</form>
			</section>
		</WorkspaceLayout>
	);
}
