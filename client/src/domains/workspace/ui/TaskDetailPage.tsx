import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import {
	projectTasksQueryKey,
	type Task,
	useProjectQuery,
	useProjectTasksQuery,
	useUpdateProjectTaskMutation,
} from "#/api/client";
import { WorkspaceLayout } from "#/domains/workspace/ui/templates/WorkspaceLayout";

type TaskFormState = {
	acceptanceCriteria: string;
	description: string;
	priority: string;
	status: string;
	tag: string;
	title: string;
};

function getFormState(task: Task): TaskFormState {
	return {
		acceptanceCriteria: task.acceptanceCriteria ?? "",
		description: task.description ?? "",
		priority: task.priority,
		status: task.status,
		tag: task.tag ?? "",
		title: task.title,
	};
}

export function TaskDetailPage() {
	const { projectId, taskId } = useParams({
		from: "/projects_/$projectId/tasks/$taskId",
	});
	const queryClient = useQueryClient();
	const projectQuery = useProjectQuery(projectId);
	const tasksQuery = useProjectTasksQuery(projectId);
	const updateTaskMutation = useUpdateProjectTaskMutation();
	const task = tasksQuery.data?.find((item) => item.id === taskId) ?? null;
	const [formState, setFormState] = useState<TaskFormState | null>(null);
	const [formError, setFormError] = useState<string | null>(null);
	const [savedMessage, setSavedMessage] = useState<string | null>(null);
	const projectName = projectQuery.data?.name ?? "Project";

	useEffect(() => {
		if (task) {
			setFormState(getFormState(task));
		}
	}, [task]);

	function updateField(field: keyof TaskFormState, value: string) {
		setFormState((current) =>
			current ? { ...current, [field]: value } : current,
		);
		setSavedMessage(null);
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setFormError(null);
		setSavedMessage(null);

		if (!formState) {
			return;
		}

		const title = formState.title.trim();
		if (!title) {
			setFormError("Task title is required.");
			return;
		}

		try {
			const updatedTask = await updateTaskMutation.mutateAsync({
				projectId,
				taskId,
				taskUpdate: {
					acceptanceCriteria: formState.acceptanceCriteria.trim() || null,
					description: formState.description.trim() || null,
					priority: formState.priority,
					status: formState.status,
					tag: formState.tag.trim() || null,
					title,
				},
			});

			queryClient.setQueryData<Task[]>(
				projectTasksQueryKey(projectId),
				(tasks) =>
					tasks?.map((item) => (item.id === taskId ? updatedTask : item)),
			);
			await queryClient.invalidateQueries({
				queryKey: projectTasksQueryKey(projectId),
			});
			setFormState(getFormState(updatedTask));
			setSavedMessage("Task changes saved.");
		} catch {
			setFormError("Task could not be saved. Please try again.");
		}
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
							className="ml-3 rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--on-primary)]"
						>
							Retry
						</button>
					</div>
				) : null}

				{!tasksQuery.isPending && !tasksQuery.isError && !task ? (
					<div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm text-[var(--on-surface-variant)]">
						This task could not be found.
						<Link
							to="/projects/$projectId"
							params={{ projectId }}
							className="ml-3 font-semibold text-[var(--primary)] no-underline hover:underline"
						>
							Back to board
						</Link>
					</div>
				) : null}

				{task && formState ? (
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

							<div className="sm:col-span-2">
								<label
									className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
									htmlFor="taskTitle"
								>
									Task Title
								</label>
								<input
									className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition placeholder:text-[var(--outline)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
									id="taskTitle"
									onChange={(event) => updateField("title", event.target.value)}
									required
									type="text"
									value={formState.title}
								/>
							</div>
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

							<div>
								<label
									className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
									htmlFor="taskStatus"
								>
									Status
								</label>
								<select
									className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
									id="taskStatus"
									onChange={(event) =>
										updateField("status", event.target.value)
									}
									value={formState.status}
								>
									<option value="todo">To Do</option>
									<option value="in-progress">In Progress</option>
									<option value="done">Done</option>
								</select>
							</div>

							<div>
								<label
									className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
									htmlFor="taskPriority"
								>
									Priority
								</label>
								<select
									className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
									id="taskPriority"
									onChange={(event) =>
										updateField("priority", event.target.value)
									}
									value={formState.priority}
								>
									<option value="low">Low</option>
									<option value="medium">Medium</option>
									<option value="high">High</option>
									<option value="urgent">Urgent</option>
								</select>
							</div>

							<div className="sm:col-span-2">
								<label
									className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
									htmlFor="taskTag"
								>
									Tag
								</label>
								<input
									className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition placeholder:text-[var(--outline)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
									id="taskTag"
									onChange={(event) => updateField("tag", event.target.value)}
									placeholder="Optional label shown on the card"
									type="text"
									value={formState.tag}
								/>
							</div>
						</section>

						<section className="grid grid-cols-1 gap-5">
							<div>
								<h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--primary)]">
									Work Notes
								</h2>
								<p className="mt-1 text-sm text-[var(--on-surface-variant)]">
									Keep context and completion criteria available from the task
									view.
								</p>
							</div>

							<div>
								<label
									className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
									htmlFor="taskDescription"
								>
									Description
								</label>
								<textarea
									className="w-full resize-none rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition placeholder:text-[var(--outline)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
									id="taskDescription"
									onChange={(event) =>
										updateField("description", event.target.value)
									}
									placeholder="Add context, background, or handoff notes..."
									rows={5}
									value={formState.description}
								/>
							</div>

							<div>
								<label
									className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
									htmlFor="taskAcceptanceCriteria"
								>
									Acceptance Criteria
								</label>
								<textarea
									className="w-full resize-none rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition placeholder:text-[var(--outline)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
									id="taskAcceptanceCriteria"
									onChange={(event) =>
										updateField("acceptanceCriteria", event.target.value)
									}
									placeholder="List the conditions that must be met for this task to be complete..."
									rows={4}
									value={formState.acceptanceCriteria}
								/>
							</div>
						</section>

						{formError ? (
							<p className="rounded-xl border border-[var(--outline-variant)] bg-[var(--error-container)] px-4 py-3 text-sm font-semibold text-[var(--on-error-container)]">
								{formError}
							</p>
						) : null}

						{savedMessage ? (
							<p className="rounded-xl border border-[var(--outline-variant)] bg-[var(--primary-fixed)] px-4 py-3 text-sm font-semibold text-[var(--on-primary-fixed)]">
								{savedMessage}
							</p>
						) : null}

						<div className="flex flex-col-reverse gap-3 border-t border-[var(--outline-variant)] pt-6 sm:flex-row sm:items-center sm:justify-end">
							<Link
								to="/projects/$projectId"
								params={{ projectId }}
								className="inline-flex items-center justify-center rounded-full border border-transparent px-5 py-2.5 text-sm font-semibold text-[var(--on-surface-variant)] no-underline transition hover:border-[var(--outline-variant)] hover:bg-[var(--surface-bright)]"
							>
								Back to Board
							</Link>
							<button
								disabled={updateTaskMutation.isPending}
								type="submit"
								className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--on-primary)] shadow-[0_12px_28px_rgba(0,61,155,0.18)] transition hover:bg-[var(--primary-container)]"
							>
								<Save className="h-4 w-4" />
								{updateTaskMutation.isPending ? "Saving..." : "Save Changes"}
							</button>
						</div>
					</form>
				) : null}
			</section>
		</WorkspaceLayout>
	);
}
