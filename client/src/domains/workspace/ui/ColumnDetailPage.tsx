import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Save, Trash2 } from "lucide-react";
import type { FormEvent } from "react";

import { useCurrentUserQuery, useKanaiApi } from "#/api/client";
import { useColumnForm } from "#/domains/workspace/model/useColumnForm";
import { WorkspaceLayout } from "#/domains/workspace/ui/templates/WorkspaceLayout";

export function ColumnDetailPage() {
	const { projectId, columnId } = useParams({
		from: "/projects_/$projectId/columns/$columnId",
	});
	const navigate = useNavigate();
	const api = useKanaiApi();
	const projectQuery = useQuery(api.projects.get(projectId));
	const columnsQuery = useQuery(api.projectColumns.list(projectId));
	const doneColumnQuery = useQuery(api.doneColumn.get(projectId));
	const tasksQuery = useQuery(api.tasks.list(projectId));
	const currentUserQuery = useCurrentUserQuery();
	const form = useColumnForm({
		projectId,
		columnId,
		project: projectQuery.data,
		columns: columnsQuery.data,
		doneColumn: doneColumnQuery.data,
		tasks: tasksQuery.data,
		currentUserId: currentUserQuery.data?.id,
		isProjectLoading: projectQuery.isPending,
		isColumnsLoading: columnsQuery.isPending,
		isTasksLoading: tasksQuery.isPending,
		isCurrentUserLoading: currentUserQuery.isPending,
		onSaved: () => {
			void navigate({ to: "/projects/$projectId", params: { projectId } });
		},
		onDeleted: () => {
			void navigate({ to: "/projects/$projectId", params: { projectId } });
		},
	});
	const projectName = projectQuery.data?.name ?? "Project";
	const columnName = form.column?.name ?? "Workflow Column";

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		await form.submit();
	}

	async function handleDelete() {
		await form.deleteColumn();
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
				{ label: columnName },
			]}
			contentContainerClassName="mx-auto flex w-full max-w-[760px] flex-col gap-8"
			contentClassName="px-4 py-8 pb-12 sm:px-6 lg:px-8"
			pageDescription="Update the workflow label and guidance shown on the project board."
			pageTitle={`Edit Column: ${columnName}`}
			sectionClassName="lg:min-h-screen"
		>
			<section className="rise-in rounded-[1.75rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_50%,transparent)] bg-[var(--surface-container-lowest)] p-6 shadow-[0_18px_42px_rgba(25,28,30,0.04)] sm:p-10">
				{form.accessState.status === "loading" ? (
					<p className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm text-[var(--on-surface-variant)]">
						{form.accessState.message}
					</p>
				) : null}

				{form.accessState.status === "not-found" ||
				form.accessState.status === "unauthorized" ||
				form.accessState.status === "load-error" ? (
					<div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm text-[var(--on-surface-variant)]">
						{form.accessState.message}
						<Link
							to="/projects/$projectId"
							params={{ projectId }}
							className="ml-3 font-semibold text-[var(--primary)] no-underline hover:underline"
						>
							Back to board
						</Link>
					</div>
				) : null}

				{form.accessState.status === "ready" ? (
					<form className="flex flex-col gap-8" onSubmit={handleSubmit}>
						<section className="grid grid-cols-1 gap-5">
							<div>
								<h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--primary)]">
									Column Details
								</h2>
								<p className="mt-1 text-sm text-[var(--on-surface-variant)]">
									Names are trimmed before saving. Blank descriptions are stored
									as empty guidance.
								</p>
							</div>

							<div>
								<label
									className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
									htmlFor="columnName"
								>
									Column Name
								</label>
								<input
									className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition placeholder:text-[var(--outline)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
									id="columnName"
									maxLength={80}
									onChange={(event) =>
										form.setField("name", event.target.value)
									}
									required
									type="text"
									value={form.values.name}
								/>
							</div>

							<div>
								<label
									className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
									htmlFor="columnDescription"
								>
									Description
								</label>
								<textarea
									className="w-full resize-none rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition placeholder:text-[var(--outline)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
									id="columnDescription"
									maxLength={500}
									onChange={(event) =>
										form.setField("description", event.target.value)
									}
									placeholder="Explain what belongs in this workflow column..."
									rows={5}
									value={form.values.description}
								/>
								<p className="mt-2 text-sm text-[var(--on-surface-variant)]">
									{form.values.description.length}/500 characters
								</p>
							</div>
						</section>

						{form.errorMessage ? (
							<p className="rounded-xl border border-[var(--outline-variant)] bg-[var(--error-container)] px-4 py-3 text-sm font-semibold text-[var(--on-error-container)]">
								{form.errorMessage}
							</p>
						) : null}

						<section className="rounded-2xl border border-[color:color-mix(in_srgb,var(--error)_32%,var(--outline-variant))] bg-[color:color-mix(in_srgb,var(--error-container)_34%,var(--surface-container-lowest))] p-5">
							<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
								<div>
									<h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--error)]">
										Delete Column
									</h2>
									<p className="mt-1 text-sm text-[var(--on-surface-variant)]">
										Delete this workflow column only when it is empty and not
										the final column in the project.
									</p>
									{form.deleteDisabledReason ? (
										<p className="mt-3 text-sm font-semibold text-[var(--on-surface)]">
											{form.deleteDisabledReason}
										</p>
									) : (
										<p className="mt-3 text-sm font-semibold text-[var(--on-surface)]">
											You will be asked to confirm. Unsaved edits on this page
											will be discarded.
										</p>
									)}
								</div>
								<button
									disabled={
										Boolean(form.deleteDisabledReason) || form.isDeleting
									}
									onClick={handleDelete}
									type="button"
									className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--error)] px-5 py-2.5 text-sm font-semibold text-[var(--on-error)] shadow-[0_12px_28px_rgba(186,26,26,0.18)] transition hover:bg-[var(--error-container)] hover:text-[var(--on-error-container)] disabled:cursor-not-allowed disabled:opacity-60"
								>
									<Trash2 className="h-4 w-4" />
									{form.isDeleting ? "Deleting..." : "Delete Column"}
								</button>
							</div>
							{form.deleteErrorMessage ? (
								<p className="mt-4 rounded-xl border border-[var(--outline-variant)] bg-[var(--error-container)] px-4 py-3 text-sm font-semibold text-[var(--on-error-container)]">
									{form.deleteErrorMessage}
								</p>
							) : null}
						</section>

						<div className="flex flex-col-reverse gap-3 border-t border-[var(--outline-variant)] pt-6 sm:flex-row sm:items-center sm:justify-end">
							<Link
								to="/projects/$projectId"
								params={{ projectId }}
								className="inline-flex items-center justify-center rounded-full border border-transparent px-5 py-2.5 text-sm font-semibold text-[var(--on-surface-variant)] no-underline transition hover:border-[var(--outline-variant)] hover:bg-[var(--surface-bright)]"
							>
								Cancel
							</Link>
							<button
								disabled={form.isSaving}
								type="submit"
								className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--on-primary)] shadow-[0_12px_28px_rgba(0,61,155,0.18)] transition hover:bg-[var(--primary-container)] disabled:cursor-not-allowed disabled:opacity-60"
							>
								<Save className="h-4 w-4" />
								{form.isSaving ? "Saving..." : "Save Changes"}
							</button>
						</div>
					</form>
				) : null}
			</section>
		</WorkspaceLayout>
	);
}
