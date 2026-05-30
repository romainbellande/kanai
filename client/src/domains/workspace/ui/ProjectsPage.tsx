import { Link } from "@tanstack/react-router";
import {
	Bell,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	CircleHelp,
	FileText,
	LayoutDashboard,
	LogOut,
	Plus,
	Search,
	Settings2,
	Target,
	TrendingUp,
	User,
	UserPlus,
} from "lucide-react";

import { useCurrentUserQuery } from "#/api/client";
import { getAuthLogoutUrl } from "#/domains/auth/model/auth-client";
import { clearAuthSession } from "#/domains/auth/model/openid-client";
import { WorkspaceIconButton } from "#/domains/workspace/ui/atoms/WorkspaceIconButton";
import { SidebarNavItem } from "#/domains/workspace/ui/molecules/SidebarNavItem";
import type { SidebarItem } from "#/domains/workspace/ui/types";

const sidebarItems: SidebarItem[] = [
	{ label: "Projects", icon: LayoutDashboard, active: true, to: "/" },
	{ label: "Team Goals", icon: Target },
	{ label: "Analytics", icon: TrendingUp },
];

const sectionTabs = [
	{ label: "Projects", active: true },
	{ label: "Team" },
	{ label: "Reports" },
	{ label: "Archives" },
];

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

	const logoutUrl = (() => {
		if (typeof window === "undefined") {
			return null;
		}

		try {
			return getAuthLogoutUrl(window.location.origin);
		} catch {
			return null;
		}
	})();

	function handleLogout() {
		if (!logoutUrl) {
			return;
		}

		clearAuthSession();
		window.location.assign(logoutUrl);
	}

	return (
		<main className="min-h-screen bg-[var(--background)] text-[var(--on-surface)]">
			<div className="flex min-h-screen flex-col lg:flex-row">
				<aside className="border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-4 lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:flex-shrink-0 lg:border-r lg:px-6 lg:py-6">
					<div className="flex h-full flex-col rounded-[1.75rem] bg-[color:color-mix(in_srgb,var(--surface-container-lowest)_78%,transparent)] p-5 shadow-[0_18px_42px_rgba(25,28,30,0.06)] backdrop-blur-xl lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none">
						<div className="flex items-start justify-between gap-3">
							<div>
								<h1 className="font-display text-xl font-bold tracking-tight text-[var(--on-surface)]">
									Executive Architect
								</h1>
								<p className="mt-1 text-sm text-[var(--on-surface-variant)]">
									Board Workspace
								</p>
							</div>
							<WorkspaceIconButton
								size="sm"
								className="bg-[var(--surface-container-highest)] text-[var(--on-surface-variant)]"
							>
								<Search className="h-4 w-4" />
							</WorkspaceIconButton>
						</div>

						<div className="mt-8 rounded-xl bg-[var(--surface-container-high)] p-3">
							<h2 className="text-sm font-semibold text-[var(--on-surface)]">
								Global Strategy
							</h2>
							<p className="mt-1 text-xs font-semibold text-[var(--on-surface-variant)]">
								Premium Tier
							</p>
						</div>

						<nav className="mt-8 flex flex-col gap-1">
							{sidebarItems.map((item) => (
								<SidebarNavItem key={item.label} {...item} />
							))}
						</nav>

						<div className="mt-8 border-t border-[var(--outline-variant)] pt-6 lg:mt-auto">
							<nav className="mb-4 flex flex-col gap-1">
								<Link
									to="/about"
									className="flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium text-[var(--on-surface-variant)] no-underline hover:bg-[var(--surface-bright)]"
								>
									<CircleHelp className="h-4 w-4" />
									Help
								</Link>
								{logoutUrl ? (
									<button
										type="button"
										onClick={handleLogout}
										className="flex items-center gap-3 rounded-full px-4 py-3 text-left text-sm font-medium text-[var(--on-surface-variant)] hover:bg-[var(--surface-bright)]"
									>
										<LogOut className="h-4 w-4" />
										Logout
									</button>
								) : (
									<Link
										to="/login"
										className="flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium text-[var(--on-surface-variant)] no-underline hover:bg-[var(--surface-bright)]"
									>
										<LogOut className="h-4 w-4" />
										Login
									</Link>
								)}
							</nav>
							<button
								type="button"
								className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--on-primary)] shadow-[0_12px_28px_rgba(0,61,155,0.18)] hover:bg-[var(--primary-container)]"
							>
								<UserPlus className="h-4 w-4" />
								Invite Member
							</button>
						</div>
					</div>
				</aside>

				<section className="min-w-0 flex-1">
					<header className="sticky top-0 z-20 flex flex-col gap-4 bg-[color:color-mix(in_srgb,var(--background)_88%,transparent)] px-4 py-4 backdrop-blur-xl sm:px-6 lg:flex-row lg:items-center lg:px-8">
						<div className="flex min-w-0 flex-1 items-center gap-5">
							<button
								type="button"
								className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--on-surface)]"
							>
								Global Strategy
								<ChevronDown className="h-4 w-4" />
							</button>
							<nav className="hidden items-center gap-5 md:flex">
								{sectionTabs.map(({ label, active }) => (
									<button
										key={label}
										type="button"
										className={[
											"border-b-2 pb-1 text-sm font-semibold",
											active
												? "border-[var(--primary)] text-[var(--primary)]"
												: "border-transparent text-[var(--on-surface-variant)] hover:text-[var(--primary)]",
										].join(" ")}
									>
										{label}
									</button>
								))}
							</nav>
						</div>

						<div className="flex min-w-0 flex-1 items-center gap-3 lg:max-w-2xl">
							<label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-2 text-[var(--on-surface-variant)] focus-within:border-[var(--primary)]">
								<Search className="h-4 w-4 flex-shrink-0" />
								<input
									className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-[var(--on-surface)] outline-none placeholder:text-[var(--on-surface-variant)]"
									placeholder="Search projects, cards, and teammates"
									type="search"
								/>
							</label>
						</div>

						<div className="flex items-center gap-2 self-end lg:self-auto">
							<WorkspaceIconButton className="text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]">
								<Bell className="h-4 w-4" />
							</WorkspaceIconButton>
							<WorkspaceIconButton className="text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]">
								<Settings2 className="h-4 w-4" />
							</WorkspaceIconButton>
							<div className="flex items-center gap-2 rounded-full border-l border-[var(--outline-variant)] py-1 pl-3 pr-4 text-sm font-semibold text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]">
								<span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-container)] text-xs font-bold text-[var(--on-primary)]">
									{accountInitials || <User className="h-4 w-4" />}
								</span>
								Account
							</div>
						</div>
					</header>

					<div className="px-4 py-6 pb-12 sm:px-6 lg:px-8">
						<div className="mx-auto flex max-w-[1180px] flex-col gap-8">
							<div>
								<div className="flex items-center gap-2 text-sm text-[var(--on-surface-variant)]">
									<span>Projects</span>
									<ChevronRight className="h-4 w-4" />
									<span className="font-medium text-[var(--on-surface)]">
										Dashboard
									</span>
								</div>
								<h2 className="font-display mt-2 text-3xl font-bold tracking-tight text-[var(--on-surface)] sm:text-[2.375rem]">
									Projects Dashboard
								</h2>
							</div>

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
						</div>
					</div>
				</section>
			</div>
		</main>
	);
}
