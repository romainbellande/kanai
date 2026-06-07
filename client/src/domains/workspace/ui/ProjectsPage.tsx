import { Link } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useState } from "react";

import {
	CurrentUserAuthError,
	getCurrentUserInitials,
	type Project,
	useCurrentUserQuery,
	useProjectsQuery,
} from "#/api/client";
import { WorkspaceLayout } from "#/domains/workspace/ui/templates/WorkspaceLayout";

function getProjectStatus(project: Project): { status: string; tone: string } {
	const normalizedStatus = project.status?.trim();
	const status = normalizedStatus || "Active";
	const tone = /blocked|risk|review/i.test(status)
		? "warning"
		: /done|complete|closed/i.test(status)
			? "secondary"
			: "primary";

	return { status, tone };
}

function ProjectStatus({ tone, status }: { tone: string; status: string }) {
	const toneClass =
		{
			primary: "bg-[var(--primary-fixed)] text-[var(--on-primary-fixed)]",
			secondary:
				"bg-[var(--secondary-container)] text-[var(--on-secondary-container)]",
			warning: "bg-[#ffdbcf] text-[#812800]",
		}[tone] ?? "bg-[var(--surface-variant)] text-[var(--on-surface-variant)]";

	return (
		<span
			className={`rounded-md px-2 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] ${toneClass}`}
		>
			{status}
		</span>
	);
}

export function ProjectsPage() {
	const [searchQuery, setSearchQuery] = useState("");
	const { data: currentUser } = useCurrentUserQuery();
	const projectsQuery = useProjectsQuery();
	const accountInitials = getCurrentUserInitials(currentUser);
	const normalizedSearchQuery = searchQuery.trim().toLowerCase();
	const projects = (projectsQuery.data ?? []).filter((project) => {
		if (!normalizedSearchQuery) {
			return true;
		}

		return [project.name, project.code, project.description ?? ""]
			.join(" ")
			.toLowerCase()
			.includes(normalizedSearchQuery);
	});
	const isAuthError = projectsQuery.error instanceof CurrentUserAuthError;

	return (
		<WorkspaceLayout
			breadcrumbItems={[{ label: "Projects" }, { label: "Dashboard" }]}
			pageTitle="Projects Dashboard"
		>
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<section className="rise-in overflow-hidden rounded-[1.75rem] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] shadow-[0_18px_42px_rgba(25,28,30,0.04)] lg:col-span-2">
					<div className="flex flex-col gap-4 border-b border-[var(--outline-variant)] p-6 sm:flex-row sm:items-center sm:justify-between">
						<h3 className="font-display text-xl font-semibold tracking-tight">
							Projects
						</h3>
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
							<label className="flex w-full items-center gap-2 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-2 text-[var(--on-surface-variant)] focus-within:border-[var(--primary)] sm:w-64">
								<Search className="h-4 w-4" />
								<input
									className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-[var(--on-surface-variant)]"
									placeholder="Search projects..."
									onChange={(event) => setSearchQuery(event.target.value)}
									type="search"
									value={searchQuery}
								/>
							</label>
							<Link
								to="/projects/new"
								aria-label="Add project"
								className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)] no-underline shadow-[0_12px_28px_rgba(0,61,155,0.18)] hover:bg-[var(--primary-container)]"
							>
								<Plus className="h-4 w-4 text-white" />
							</Link>
						</div>
					</div>

					<div className="flex flex-col gap-2 p-4">
						{projectsQuery.isPending ? (
							<p className="rounded-xl p-4 text-sm text-[var(--on-surface-variant)]">
								Loading projects...
							</p>
						) : null}
						{projectsQuery.isError ? (
							<div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
								<p className="text-sm font-semibold text-[var(--on-surface)]">
									{isAuthError
										? "Sign in again to load your projects."
										: "Projects could not be loaded."}
								</p>
								<button
									type="button"
									onClick={() => void projectsQuery.refetch()}
									className="mt-3 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)]"
								>
									Retry
								</button>
							</div>
						) : null}
						{!projectsQuery.isPending &&
						!projectsQuery.isError &&
						projects.length === 0 ? (
							<div className="rounded-xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-6 text-center">
								<p className="text-sm font-semibold text-[var(--on-surface)]">
									{normalizedSearchQuery
										? "No projects match your search."
										: "No projects yet."}
								</p>
								<Link
									to="/projects/new"
									className="mt-3 inline-flex rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] no-underline"
								>
									Create a project
								</Link>
							</div>
						) : null}
						{projects.map((project) => {
							const status = getProjectStatus(project);

							return (
								<Link
									key={project.id}
									to="/projects/$projectId"
									params={{ projectId: project.id }}
									className="flex flex-col gap-4 rounded-xl border border-transparent p-4 text-inherit no-underline hover:border-[var(--outline-variant)] hover:bg-[var(--surface-bright)] sm:flex-row sm:items-center sm:justify-between"
								>
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center gap-2">
											<h4 className="text-sm font-semibold text-[var(--on-surface)]">
												{project.name}
											</h4>
											<ProjectStatus {...status} />
											<span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--on-surface-variant)]">
												{project.code}
											</span>
										</div>
										<p className="mt-1 text-sm leading-6 text-[var(--on-surface-variant)]">
											{project.description || "No description provided."}
										</p>
									</div>
									<span className="inline-flex items-center justify-center rounded-full bg-[var(--primary-container)] px-5 py-2 text-sm font-semibold text-[var(--on-primary)] hover:bg-[var(--primary)]">
										Open Board
									</span>
								</Link>
							);
						})}
					</div>

					<div className="flex flex-col gap-3 border-t border-[var(--outline-variant)] p-5 text-sm font-semibold text-[var(--on-surface-variant)] sm:flex-row sm:items-center sm:justify-between">
						<span>
							{projectsQuery.data
								? `${projects.length} of ${projectsQuery.data.length} projects`
								: "Project count unavailable"}
						</span>
					</div>
				</section>

				<section className="rise-in overflow-hidden rounded-[1.75rem] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] shadow-[0_18px_42px_rgba(25,28,30,0.04)] [animation-delay:80ms]">
					<div className="border-b border-[var(--outline-variant)] p-6">
						<h3 className="font-display text-xl font-semibold tracking-tight">
							Recent Activity
						</h3>
					</div>
					<div className="flex max-h-[400px] flex-col gap-5 overflow-y-auto p-5">
						<div className="flex gap-3">
							<span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary-container)] text-xs font-semibold text-[var(--on-primary)]">
								{accountInitials || "--"}
							</span>
							<div>
								<p className="text-sm leading-6">
									Recent project activity is not available from the API yet.
								</p>
								<p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">
									Open a project board to view persisted tasks.
								</p>
							</div>
						</div>
					</div>
				</section>
			</div>
		</WorkspaceLayout>
	);
}
