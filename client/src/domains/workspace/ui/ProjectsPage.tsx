import { Link } from "@tanstack/react-router";
import {
	ChevronLeft,
	ChevronRight,
	FileText,
	Plus,
	Search,
} from "lucide-react";

import { useCurrentUserQuery } from "#/api/client";
import { WorkspaceLayout } from "#/domains/workspace/ui/templates/WorkspaceLayout";

const projects = [
	{
		id: "enterprise-launch",
		name: "Enterprise Launch",
		description: "Finalizing marketing assets and press release schedule.",
		status: "On Track",
		tone: "primary",
	},
	{
		id: "q4-logistics-scaling",
		name: "Q4 Logistics Scaling",
		description: "Awaiting budget approval for southeast asia expansion.",
		status: "Review Required",
		tone: "warning",
	},
	{
		id: "security-audit-phase-1",
		name: "Security Audit Phase 1",
		description: "Penetration testing on primary database clusters.",
		status: "In Progress",
		tone: "secondary",
	},
];

function getInitials(value: string | null | undefined): string {
	const normalizedValue = value?.trim();

	return normalizedValue ? normalizedValue.slice(0, 1).toUpperCase() : "";
}

function ProjectStatus({ tone, status }: { tone: string; status: string }) {
	const toneClass = {
		primary: "bg-[var(--primary-fixed)] text-[var(--on-primary-fixed)]",
		secondary:
			"bg-[var(--secondary-container)] text-[var(--on-secondary-container)]",
		warning: "bg-[#ffdbcf] text-[#812800]",
	}[tone];

	return (
		<span
			className={`rounded-md px-2 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] ${toneClass}`}
		>
			{status}
		</span>
	);
}

export function ProjectsPage() {
	const { data: currentUser } = useCurrentUserQuery();
	const accountInitials = [
		getInitials(currentUser?.first_name),
		getInitials(currentUser?.last_name),
	]
		.join("")
		.trim();

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
									type="search"
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
						{projects.map((project) => (
							<Link
								key={project.name}
								to="/projects/$projectId"
								params={{ projectId: project.id }}
								className="flex flex-col gap-4 rounded-xl border border-transparent p-4 text-inherit no-underline hover:border-[var(--outline-variant)] hover:bg-[var(--surface-bright)] sm:flex-row sm:items-center sm:justify-between"
							>
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<h4 className="text-sm font-semibold text-[var(--on-surface)]">
											{project.name}
										</h4>
										<ProjectStatus
											status={project.status}
											tone={project.tone}
										/>
									</div>
									<p className="mt-1 text-sm leading-6 text-[var(--on-surface-variant)]">
										{project.description}
									</p>
								</div>
								<span className="inline-flex items-center justify-center rounded-full bg-[var(--primary-container)] px-5 py-2 text-sm font-semibold text-[var(--on-primary)] hover:bg-[var(--primary)]">
									Open Board
								</span>
							</Link>
						))}
					</div>

					<div className="flex flex-col gap-3 border-t border-[var(--outline-variant)] p-5 text-sm font-semibold text-[var(--on-surface-variant)] sm:flex-row sm:items-center sm:justify-between">
						<span>Showing 1-3 of 12</span>
						<div className="flex items-center gap-1">
							<button
								type="button"
								disabled
								className="flex h-8 w-8 items-center justify-center rounded-full opacity-50"
							>
								<ChevronLeft className="h-4 w-4" />
							</button>
							{[1, 2, 3].map((page) => (
								<button
									key={page}
									type="button"
									className={[
										"flex h-8 w-8 items-center justify-center rounded-full",
										page === 1
											? "bg-[var(--primary)] text-[var(--on-primary)]"
											: "hover:bg-[var(--surface-container-high)]",
									].join(" ")}
								>
									{page}
								</button>
							))}
							<button
								type="button"
								className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--surface-container-high)]"
							>
								<ChevronRight className="h-4 w-4" />
							</button>
						</div>
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
							<span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary-fixed)] text-xs font-semibold text-[var(--on-primary-fixed)]">
								RS
							</span>
							<div>
								<p className="text-sm leading-6">
									<strong>Rachel Smith</strong> moved{" "}
									<strong>Drafting Q4 Budget</strong> to{" "}
									<span className="font-medium text-[var(--primary)]">
										In Progress
									</span>
								</p>
								<span className="text-xs font-semibold text-[var(--on-surface-variant)]">
									2 hours ago
								</span>
							</div>
						</div>

						<div className="flex gap-3">
							<span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#ffdbcf] text-xs font-semibold text-[#812800]">
								AM
							</span>
							<div>
								<p className="text-sm leading-6">
									<strong>Alex Mercer</strong> attached a file to{" "}
									<strong>Market Research</strong>
								</p>
								<div className="mt-2 inline-flex items-center gap-1 rounded-md border border-[var(--outline-variant)] bg-[var(--surface-container-high)] px-2 py-1 text-xs font-semibold text-[var(--on-surface-variant)]">
									<FileText className="h-3.5 w-3.5" />
									Q3_Analysis.pdf
								</div>
								<div className="mt-2 text-xs font-semibold text-[var(--on-surface-variant)]">
									4 hours ago
								</div>
							</div>
						</div>

						<div className="flex gap-3">
							<span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary-container)] text-xs font-semibold text-[var(--on-primary)]">
								{accountInitials || "JD"}
							</span>
							<div>
								<p className="text-sm leading-6">
									<strong>You</strong> commented on{" "}
									<strong>Security Audit Phase 1</strong>
								</p>
								<p className="mt-2 border-l-2 border-[var(--primary-fixed)] pl-3 text-sm italic leading-6 text-[var(--on-surface-variant)]">
									Please ensure the compliance docs are updated before
									archiving.
								</p>
								<div className="mt-2 text-xs font-semibold text-[var(--on-surface-variant)]">
									Yesterday
								</div>
							</div>
						</div>
					</div>
				</section>
			</div>
		</WorkspaceLayout>
	);
}
