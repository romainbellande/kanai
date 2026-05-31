import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { CirclePlus } from "lucide-react";
import { type FormEvent, useState } from "react";

import {
	projectTasksQueryKey,
	useCreateProjectTaskMutation,
	useProjectQuery,
} from "#/api/client";
import { WorkspaceLayout } from "#/domains/workspace/ui/templates/WorkspaceLayout";

export function CreateTaskPage() {
	const { projectId } = useParams({ from: "/projects_/$projectId/tasks/new" });
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const projectQuery = useProjectQuery(projectId);
	const createTaskMutation = useCreateProjectTaskMutation();
	const [formError, setFormError] = useState<string | null>(null);
	const projectName = projectQuery.data?.name ?? "Project";

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setFormError(null);

		const formData = new FormData(event.currentTarget);
		const title = String(formData.get("taskTitle") ?? "").trim();
		const description = String(formData.get("taskDescription") ?? "").trim();
		const acceptanceCriteria = String(
			formData.get("taskAcceptanceCriteria") ?? "",
		).trim();

		if (!title) {
			setFormError("Task title is required.");
			return;
		}

		try {
			await createTaskMutation.mutateAsync({
				projectId,
				taskCreate: {
					title,
					status: String(formData.get("taskStatus") ?? "todo"),
					priority: String(formData.get("taskPriority") ?? "medium"),
					description: description || undefined,
					acceptanceCriteria: acceptanceCriteria || undefined,
				},
			});
			await queryClient.invalidateQueries({
				queryKey: projectTasksQueryKey(projectId),
			});
			void navigate({ to: "/projects/$projectId", params: { projectId } });
		} catch {
			setFormError("Task could not be created. Please try again.");
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
				{ label: "New Task" },
			]}
			contentContainerClassName="mx-auto flex w-full max-w-[760px] flex-col gap-8"
			contentClassName="px-4 py-8 pb-12 sm:px-6 lg:px-8"
			pageDescription="Capture the work item and assign the details needed to move it forward."
			pageTitle="Create New Task"
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
									name="taskTitle"
									placeholder="e.g., Finalize launch readiness checklist"
									required
									type="text"
								/>
							</div>
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

							<div>
								<label
									className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
									htmlFor="taskStatus"
								>
									Status
								</label>
								<select
									className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
									defaultValue="todo"
									id="taskStatus"
									name="taskStatus"
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
									defaultValue="medium"
									id="taskPriority"
									name="taskPriority"
								>
									<option value="low">Low</option>
									<option value="medium">Medium</option>
									<option value="high">High</option>
									<option value="urgent">Urgent</option>
								</select>
							</div>

							<div className="sm:col-span-2 rounded-2xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 text-sm leading-6 text-[var(--on-surface-variant)]">
								Assignees are not editable until the user directory API is
								available. This task will be created without an assignee.
							</div>
						</section>

						<section className="grid grid-cols-1 gap-5">
							<div>
								<h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--primary)]">
									Work Notes
								</h2>
								<p className="mt-1 text-sm text-[var(--on-surface-variant)]">
									Separate background context from the conditions required to
									finish.
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
									name="taskDescription"
									placeholder="Add context, background, or handoff notes..."
									rows={5}
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
									name="taskAcceptanceCriteria"
									placeholder="List the conditions that must be met for this task to be complete..."
									rows={4}
								/>
							</div>
						</section>
					</div>

					{formError ? (
						<p className="rounded-xl border border-[var(--outline-variant)] bg-[var(--error-container)] px-4 py-3 text-sm font-semibold text-[var(--on-error-container)]">
							{formError}
						</p>
					) : null}

					<div className="flex flex-col-reverse gap-3 border-t border-[var(--outline-variant)] pt-6 sm:flex-row sm:items-center sm:justify-end">
						<Link
							to="/projects/$projectId"
							params={{ projectId }}
							className="inline-flex items-center justify-center rounded-full border border-transparent px-5 py-2.5 text-sm font-semibold text-[var(--on-surface-variant)] no-underline transition hover:border-[var(--outline-variant)] hover:bg-[var(--surface-bright)]"
						>
							Cancel
						</Link>
						<button
							disabled={createTaskMutation.isPending}
							type="submit"
							className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--on-primary)] shadow-[0_12px_28px_rgba(0,61,155,0.18)] transition hover:bg-[var(--primary-container)]"
						>
							<CirclePlus className="h-4 w-4" />
							{createTaskMutation.isPending ? "Creating..." : "Create Task"}
						</button>
					</div>
				</form>
			</section>
		</WorkspaceLayout>
	);
}
