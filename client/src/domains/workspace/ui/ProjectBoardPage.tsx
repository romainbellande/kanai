import { Link, useParams } from "@tanstack/react-router";
import {
	Bell,
	Calendar,
	ChevronRight,
	CircleHelp,
	FileText,
	Filter,
	LayoutDashboard,
	LogOut,
	MoreHorizontal,
	Plus,
	Search,
	Settings2,
	Share2,
	Target,
	TrendingUp,
	User,
	UserPlus,
} from "lucide-react";

import {
	CurrentUserAuthError,
	type Task,
	useCurrentUserQuery,
	useProjectQuery,
	useProjectTasksQuery,
} from "#/api/client";
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

const columnDefinitions = [
	{ id: "todo", title: "To Do" },
	{ id: "in-progress", title: "In Progress" },
	{ id: "done", title: "Done" },
] as const;

type ColumnId = (typeof columnDefinitions)[number]["id"];

type BoardColumn = {
	id: ColumnId;
	title: string;
	cards: Task[];
};

function getColumnId(status: string): ColumnId {
	const normalizedStatus = status.trim().toLowerCase();

	if (["done", "complete", "completed", "closed"].includes(normalizedStatus)) {
		return "done";
	}

	if (
		["in-progress", "in progress", "doing", "active"].includes(normalizedStatus)
	) {
		return "in-progress";
	}

	return "todo";
}

export function groupTasksByColumn(
	tasks: Task[],
	projectId: string,
): BoardColumn[] {
	const columns: BoardColumn[] = columnDefinitions.map((column) => ({
		...column,
		cards: [],
	}));

	for (const task of tasks) {
		if (task.projectId !== projectId) {
			continue;
		}

		const column = columns.find(({ id }) => id === getColumnId(task.status));

		column?.cards.push(task);
	}

	return columns;
}

function getTagClass(priority: string): string {
	return /urgent|high/i.test(priority)
		? "bg-[var(--error-container)] text-[var(--on-error-container)]"
		: "bg-[var(--secondary-container)] text-[var(--on-secondary-container)]";
}

function getTaskMeta(task: Task): string {
	return (
		task.updatedAt?.toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
		}) ?? "No activity date"
	);
}

function getInitials(value: string | null | undefined): string {
	const normalizedValue = value?.trim();

	return normalizedValue ? normalizedValue.slice(0, 1).toUpperCase() : "";
}

export function ProjectBoardPage() {
	const { projectId } = useParams({ from: "/projects/$projectId" });
	const { data: currentUser } = useCurrentUserQuery();
	const projectQuery = useProjectQuery(projectId);
	const tasksQuery = useProjectTasksQuery(projectId);
	const projectName = projectQuery.data?.name ?? "Project";
	const columns = groupTasksByColumn(tasksQuery.data ?? [], projectId);
	const isProjectAuthError = projectQuery.error instanceof CurrentUserAuthError;
	const isTasksAuthError = tasksQuery.error instanceof CurrentUserAuthError;
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
		<main className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--on-surface)]">
			<div className="flex min-h-screen flex-col lg:flex-row">
				<aside className="border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-4 lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:flex-shrink-0 lg:border-r lg:px-6 lg:py-6">
					<div className="flex h-full flex-col rounded-[1.75rem] bg-[color:color-mix(in_srgb,var(--surface-container-lowest)_78%,transparent)] p-5 shadow-[0_18px_42px_rgba(25,28,30,0.06)] backdrop-blur-xl lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none">
						<div className="flex items-start justify-between gap-3">
							<div>
								<h1 className="font-display text-xl font-bold tracking-tight">
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
							<h2 className="text-sm font-semibold">Global Strategy</h2>
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
								disabled
								className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--on-primary)] shadow-[0_12px_28px_rgba(0,61,155,0.18)] hover:bg-[var(--primary-container)]"
							>
								<UserPlus className="h-4 w-4" />
								Invites unavailable
							</button>
						</div>
					</div>
				</aside>

				<section className="flex min-w-0 flex-1 flex-col lg:h-screen">
					<header className="sticky top-0 z-20 grid gap-4 border-[var(--outline-variant)] bg-[color:color-mix(in_srgb,var(--background)_88%,transparent)] px-4 py-4 backdrop-blur-xl sm:px-6 lg:grid-cols-[1fr_minmax(0,42rem)_1fr] lg:items-center lg:border-b lg:px-8">
						<label className="flex min-w-0 items-center gap-2 rounded-full bg-[var(--primary-fixed)] px-4 py-2 text-[var(--on-primary-fixed)] focus-within:ring-2 focus-within:ring-[var(--primary)] lg:col-start-2">
							<Search className="h-4 w-4 flex-shrink-0" />
							<input
								className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-[var(--on-primary-fixed)]"
								placeholder="Search projects, cards, and teammates"
								type="search"
							/>
						</label>

						<div className="flex items-center gap-2 justify-self-end lg:col-start-3 lg:row-start-1">
							<WorkspaceIconButton className="text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]">
								<Bell className="h-4 w-4" />
							</WorkspaceIconButton>
							<WorkspaceIconButton className="text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]">
								<Settings2 className="h-4 w-4" />
							</WorkspaceIconButton>
							<div className="flex items-center gap-2 rounded-full border-l border-[var(--outline-variant)] py-1 pl-3 pr-4 text-sm font-semibold hover:bg-[var(--surface-container-low)]">
								<span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-container)] text-xs font-bold text-[var(--on-primary)]">
									{accountInitials || <User className="h-4 w-4" />}
								</span>
								Account
							</div>
						</div>
					</header>

					<div className="flex-1 overflow-x-auto px-4 py-6 pb-12 sm:px-6 lg:px-8">
						<div className="mb-6 min-w-[1100px]">
							<div className="flex items-center gap-2 text-sm text-[var(--on-surface-variant)]">
								<Link
									to="/"
									className="text-inherit no-underline hover:text-[var(--primary)]"
								>
									Projects
								</Link>
								<ChevronRight className="h-4 w-4" />
								<span>
									{projectQuery.isPending ? "Loading project..." : projectName}
								</span>
							</div>
							{projectQuery.isError ? (
								<div className="mt-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3 text-sm text-[var(--on-surface-variant)]">
									{isProjectAuthError
										? "Sign in again to load this project."
										: "Project details could not be loaded."}
								</div>
							) : null}
							<div className="mt-3 flex items-center justify-between gap-4">
								<h2 className="font-display text-3xl font-bold tracking-tight text-[var(--on-surface)] sm:text-[2.375rem]">
									{projectQuery.data
										? `Main Board: ${projectQuery.data.name}`
										: "Main Board"}
								</h2>
								<div className="flex items-center gap-3">
									<div className="flex rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-1 shadow-sm">
										<button
											type="button"
											className="rounded-full bg-[var(--surface-variant)] px-3 py-1.5 text-sm font-semibold"
										>
											Board
										</button>
										<button
											type="button"
											className="rounded-full px-3 py-1.5 text-sm font-semibold text-[var(--on-surface-variant)] hover:bg-[var(--surface-bright)]"
										>
											Calendar
										</button>
									</div>
									<div className="flex -space-x-2">
										<span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--background)] bg-[var(--surface-variant)] text-xs font-bold">
											{accountInitials || <User className="h-4 w-4" />}
										</span>
									</div>
									<button
										type="button"
										className="inline-flex items-center gap-2 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-bright)]"
									>
										<Filter className="h-4 w-4" />
										Filter
									</button>
									<button
										type="button"
										className="inline-flex items-center gap-2 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-bright)]"
									>
										<Share2 className="h-4 w-4" />
										Share
									</button>
								</div>
							</div>
						</div>

						{tasksQuery.isError ? (
							<div className="mb-4 min-w-[1100px] rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4 text-sm text-[var(--on-surface-variant)]">
								{isTasksAuthError
									? "Sign in again to load tasks."
									: "Tasks could not be loaded."}
								<button
									type="button"
									onClick={() => void tasksQuery.refetch()}
									className="ml-3 rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--on-primary)]"
								>
									Retry
								</button>
							</div>
						) : null}
						<div className="flex min-w-[1100px] gap-6">
							{columns.map((column) => (
								<section
									key={column.title}
									className="flex w-[340px] flex-shrink-0 flex-col rounded-[1.5rem] bg-[var(--surface-container)] p-4"
								>
									<div className="mb-4 flex items-center justify-between px-2">
										<div className="flex items-center gap-2">
											<h3 className="text-sm font-semibold">{column.title}</h3>
											<span className="text-xs font-semibold text-[var(--on-surface-variant)]">
												{column.cards.length}
											</span>
										</div>
										<WorkspaceIconButton
											size="sm"
											className="bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)]"
										>
											<MoreHorizontal className="h-4 w-4" />
										</WorkspaceIconButton>
									</div>

									<div className="flex flex-col gap-4">
										{tasksQuery.isPending ? (
											<p className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 text-sm text-[var(--on-surface-variant)]">
												Loading tasks...
											</p>
										) : null}
										{!tasksQuery.isPending &&
										!tasksQuery.isError &&
										column.cards.length === 0 ? (
											<p className="rounded-2xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 text-sm text-[var(--on-surface-variant)]">
												No tasks in {column.title.toLowerCase()}.
											</p>
										) : null}
										{column.cards.map((card) => (
											<article
												key={card.id}
												className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 shadow-sm transition hover:border-[var(--outline)] hover:bg-[var(--surface-bright)]"
											>
												{card.tag || card.priority ? (
													<span
														className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getTagClass(card.priority)}`}
													>
														{card.tag || card.priority}
													</span>
												) : null}
												<p
													className={[
														"mt-3 text-sm leading-6",
														column.id === "done"
															? "text-[var(--on-surface-variant)] line-through"
															: "text-[var(--on-surface)]",
													].join(" ")}
												>
													{card.title}
												</p>
												{card.description ? (
													<p className="mt-2 text-xs leading-5 text-[var(--on-surface-variant)]">
														{card.description}
													</p>
												) : null}
												<div className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[var(--surface-variant)] px-2 py-1 text-xs font-semibold text-[var(--on-surface-variant)]">
													{column.id === "in-progress" ? (
														<FileText className="h-3.5 w-3.5" />
													) : (
														<Calendar className="h-3.5 w-3.5" />
													)}
													{getTaskMeta(card)}
												</div>
											</article>
										))}
									</div>

									<Link
										to="/projects/$projectId/tasks/new"
										params={{ projectId }}
										className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 text-sm font-semibold text-[var(--on-surface-variant)] hover:bg-[var(--surface-bright)]"
									>
										<Plus className="h-4 w-4" />
										Add a task
									</Link>
								</section>
							))}

							<button
								type="button"
								className="flex min-h-32 w-[340px] flex-shrink-0 items-center justify-center gap-2 rounded-[1.5rem] border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 text-sm font-semibold text-[var(--on-surface-variant)] hover:bg-[var(--surface-bright)]"
							>
								<Plus className="h-4 w-4" />
								Add another list
							</button>
						</div>
					</div>
				</section>
			</div>
		</main>
	);
}
