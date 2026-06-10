import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Columns3, Plus } from "lucide-react";
import type { FormEvent } from "react";

import { useCurrentUserQuery, useKanaiApi } from "#/api/client";
import {
	COLUMN_DESCRIPTION_MAX_LENGTH,
	useColumnForm,
} from "#/domains/workspace/model/useColumnForm";
import { WorkspaceLayout } from "#/domains/workspace/ui/templates/WorkspaceLayout";

export function CreateColumnPage() {
	const { projectId } = useParams({
		from: "/projects_/$projectId/columns/new",
	});
	const navigate = useNavigate();
	const api = useKanaiApi();
	const { data: currentUser } = useCurrentUserQuery();
	const projectQuery = useQuery(api.projects.get(projectId));
	const columnsQuery = useQuery(api.projectColumns.list(projectId));
	const projectName = projectQuery.data?.name ?? "Project";
	const isProjectOwner = Boolean(
		currentUser && projectQuery.data?.ownerIds.includes(currentUser.id),
	);
	const form = useColumnForm({
		projectId,
		columns: columnsQuery.data,
		onSaved: () => {
			void navigate({ to: "/projects/$projectId", params: { projectId } });
		},
	});

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
				{ label: "New Column" },
			]}
			contentContainerClassName="mx-auto flex w-full max-w-[720px] flex-col gap-8"
			contentClassName="px-4 py-8 pb-12 sm:px-6 lg:px-8"
			pageDescription="Add a workflow stage to the end of this project board."
			pageTitle="Create New Column"
			sectionClassName="lg:min-h-screen"
		>
			{projectQuery.data && !isProjectOwner ? (
				<section className="rise-in rounded-[1.75rem] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-6 text-[var(--on-surface)] shadow-[0_18px_42px_rgba(25,28,30,0.04)] sm:p-10">
					<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--error-container)] text-[var(--on-error-container)]">
						<Columns3 className="h-5 w-5" />
					</div>
					<h2 className="mt-5 font-display text-2xl font-bold">
						Only project owners can create columns.
					</h2>
					<p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">
						You can still view the project board, but column management is
						limited to project owners.
					</p>
					<Link
						to="/projects/$projectId"
						params={{ projectId }}
						className="mt-6 inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[color:var(--on-primary)] no-underline"
					>
						Back to board
					</Link>
				</section>
			) : (
				<section className="rise-in rounded-[1.75rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_50%,transparent)] bg-[var(--surface-container-lowest)] p-6 shadow-[0_18px_42px_rgba(25,28,30,0.04)] sm:p-10">
					{projectQuery.isError ? (
						<p className="mb-6 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm text-[var(--on-surface-variant)]">
							Project details could not be loaded, but you can still create a
							column for this project ID.
						</p>
					) : null}
					<form className="flex flex-col gap-8" onSubmit={handleSubmit}>
						<section className="grid grid-cols-1 gap-5">
							<div>
								<h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--primary)]">
									Column Details
								</h2>
								<p className="mt-1 text-sm text-[var(--on-surface-variant)]">
									Name the workflow stage and optionally explain what belongs
									there.
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
									name="columnName"
									placeholder="e.g., Ready for Review"
									required
									type="text"
									value={form.values.name}
									onChange={(event) =>
										form.setField("name", event.target.value)
									}
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
									name="columnDescription"
									placeholder="Add brief guidance for teammates..."
									rows={5}
									value={form.values.description}
									onChange={(event) =>
										form.setField("description", event.target.value)
									}
								/>
								<p className="mt-2 text-sm text-[var(--on-surface-variant)]">
									{form.values.description.trim().length}/
									{COLUMN_DESCRIPTION_MAX_LENGTH} characters
								</p>
							</div>
						</section>

						{form.errorMessage ? (
							<p className="rounded-xl border border-[var(--outline-variant)] bg-[var(--error-container)] px-4 py-3 text-sm font-semibold text-[var(--on-error-container)]">
								{form.errorMessage}
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
								disabled={
									form.isSaving || columnsQuery.isError || !isProjectOwner
								}
								type="submit"
								className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[color:var(--on-primary)] shadow-[0_12px_28px_rgba(0,61,155,0.18)] transition hover:bg-[var(--primary-container)] disabled:cursor-not-allowed disabled:opacity-60"
							>
								<Plus className="h-4 w-4" />
								{form.isSaving ? "Creating..." : "Create Column"}
							</button>
						</div>
					</form>
				</section>
			)}
		</WorkspaceLayout>
	);
}
