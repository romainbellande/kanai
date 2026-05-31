import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
	draggable,
	dropTargetForElements,
	monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
	attachClosestEdge,
	extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { useQueryClient } from "@tanstack/react-query";
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
import { type ReactNode, useEffect, useRef, useState } from "react";

import {
	CurrentUserAuthError,
	projectTasksQueryKey,
	type Task,
	useCurrentUserQuery,
	useProjectQuery,
	useProjectTasksQuery,
	useUpdateProjectTaskMutation,
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

type CardDropTargetData = {
	type: "card";
	taskId: string;
	columnId: ColumnId;
};

type ColumnDropTargetData = {
	type: "column";
	columnId: ColumnId;
};

const rankAlphabet =
	"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function rankBetween(
	before: string | null,
	after: string | null,
): string {
	if (before !== null && after !== null && before >= after) {
		throw new Error("before rank must sort before after rank");
	}

	const base = rankAlphabet.length;
	let prefix = "";
	let index = 0;

	while (true) {
		const beforeDigit =
			before !== null && index < before.length
				? rankAlphabet.indexOf(before[index])
				: 0;
		const afterDigit =
			after !== null && index < after.length
				? rankAlphabet.indexOf(after[index])
				: base - 1;

		if (afterDigit - beforeDigit > 1) {
			return `${prefix}${rankAlphabet[Math.floor((beforeDigit + afterDigit) / 2)]}`;
		}

		prefix = `${prefix}${rankAlphabet[beforeDigit]}`;
		index += 1;
	}
}

function compareTasksByRank(first: Task, second: Task): number {
	if (first.rank !== second.rank) {
		return first.rank < second.rank ? -1 : 1;
	}

	return (
		(first.createdAt?.getTime() ?? 0) - (second.createdAt?.getTime() ?? 0) ||
		first.id.localeCompare(second.id)
	);
}

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

	return columns.map((column) => ({
		...column,
		cards: column.cards.sort(compareTasksByRank),
	}));
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

function getDestinationIndex({
	cards,
	sourceTaskId,
	targetTaskId,
	closestEdge,
}: {
	cards: Task[];
	sourceTaskId: string;
	targetTaskId: string;
	closestEdge: "top" | "bottom" | null;
}): number {
	const targetIndex = cards.findIndex((card) => card.id === targetTaskId);
	if (targetIndex === -1) {
		return cards.length;
	}

	const sourceIndex = cards.findIndex((card) => card.id === sourceTaskId);
	const isSameColumn = sourceIndex !== -1;
	let destinationIndex =
		closestEdge === "bottom" ? targetIndex + 1 : targetIndex;

	if (isSameColumn && sourceIndex < destinationIndex) {
		destinationIndex -= 1;
	}

	return Math.max(0, Math.min(destinationIndex, cards.length));
}

export function getRankForDestination(
	cards: Task[],
	destinationIndex: number,
): string {
	return rankBetween(
		cards[destinationIndex - 1]?.rank ?? null,
		cards[destinationIndex]?.rank ?? null,
	);
}

function getDropColumnId(
	data: Record<string | symbol, unknown> | undefined,
): ColumnId | null {
	const columnId = data?.columnId;
	return typeof columnId === "string" && getColumnId(columnId) === columnId
		? columnId
		: null;
}

function BoardTaskCard({
	card,
	columnId,
	isDragging,
	onDragStateChange,
}: {
	card: Task;
	columnId: ColumnId;
	isDragging: boolean;
	onDragStateChange: (taskId: string | null) => void;
}) {
	const ref = useRef<HTMLElement | null>(null);

	useEffect(() => {
		const element = ref.current;
		if (!element) {
			return;
		}

		return combine(
			draggable({
				element,
				getInitialData: () => ({
					type: "card",
					taskId: card.id,
					columnId,
				}),
				onDragStart: () => onDragStateChange(card.id),
				onDrop: () => onDragStateChange(null),
			}),
			dropTargetForElements({
				element,
				canDrop: ({ source }) => source.data.type === "card",
				getData: ({ input }) =>
					attachClosestEdge(
						{
							type: "card",
							taskId: card.id,
							columnId,
						} satisfies CardDropTargetData,
						{ input, element, allowedEdges: ["top", "bottom"] },
					),
			}),
		);
	}, [card.id, columnId, onDragStateChange]);

	return (
		<article
			ref={ref}
			className={[
				"rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 shadow-sm transition hover:border-[var(--outline)] hover:bg-[var(--surface-bright)]",
				isDragging
					? "opacity-45 ring-2 ring-[var(--primary)]"
					: "cursor-grab active:cursor-grabbing",
			].join(" ")}
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
					columnId === "done"
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
				{columnId === "in-progress" ? (
					<FileText className="h-3.5 w-3.5" />
				) : (
					<Calendar className="h-3.5 w-3.5" />
				)}
				{getTaskMeta(card)}
			</div>
		</article>
	);
}

function BoardColumnView({
	column,
	projectId,
	isActiveDropTarget,
	children,
}: {
	column: BoardColumn;
	projectId: string;
	isActiveDropTarget: boolean;
	children: ReactNode;
}) {
	const ref = useRef<HTMLElement | null>(null);

	useEffect(() => {
		const element = ref.current;
		if (!element) {
			return;
		}

		return dropTargetForElements({
			element,
			canDrop: ({ source }) => source.data.type === "card",
			getData: () =>
				({
					type: "column",
					columnId: column.id,
				}) satisfies ColumnDropTargetData,
		});
	}, [column.id]);

	return (
		<section
			ref={ref}
			className={[
				"flex w-[340px] flex-shrink-0 flex-col rounded-[1.5rem] bg-[var(--surface-container)] p-4 transition",
				isActiveDropTarget ? "ring-2 ring-[var(--primary)]" : "",
			].join(" ")}
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

			<div className="flex flex-col gap-4">{children}</div>

			<Link
				to="/projects/$projectId/tasks/new"
				params={{ projectId }}
				className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 text-sm font-semibold text-[var(--on-surface-variant)] hover:bg-[var(--surface-bright)]"
			>
				<Plus className="h-4 w-4" />
				Add a task
			</Link>
		</section>
	);
}

export function ProjectBoardPage() {
	const { projectId } = useParams({ from: "/projects/$projectId" });
	const { data: currentUser } = useCurrentUserQuery();
	const projectQuery = useProjectQuery(projectId);
	const tasksQuery = useProjectTasksQuery(projectId);
	const queryClient = useQueryClient();
	const updateTaskMutation = useUpdateProjectTaskMutation();
	const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
	const [activeDropColumnId, setActiveDropColumnId] = useState<ColumnId | null>(
		null,
	);
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

	useEffect(() => {
		return monitorForElements({
			canMonitor: ({ source }) => source.data.type === "card",
			onDropTargetChange: ({ location }) => {
				setActiveDropColumnId(
					getDropColumnId(location.current.dropTargets[0]?.data),
				);
			},
			onDrop: ({ source, location }) => {
				setActiveDropColumnId(null);
				setDraggingTaskId(null);

				if (source.data.type !== "card") {
					return;
				}

				const sourceTaskId = source.data.taskId;
				if (typeof sourceTaskId !== "string") {
					return;
				}

				const target = location.current.dropTargets[0];
				const destinationColumnId = getDropColumnId(target?.data);
				if (!target || destinationColumnId === null) {
					return;
				}

				const sourceTask = (tasksQuery.data ?? []).find(
					(task) => task.id === sourceTaskId,
				);
				const destinationColumn = columns.find(
					(column) => column.id === destinationColumnId,
				);
				if (!sourceTask || !destinationColumn) {
					return;
				}

				let destinationIndex = destinationColumn.cards.filter(
					(card) => card.id !== sourceTaskId,
				).length;

				if (target.data.type === "card") {
					const targetTaskId = target.data.taskId;
					if (
						targetTaskId === sourceTaskId ||
						typeof targetTaskId !== "string"
					) {
						return;
					}

					const closestEdge = extractClosestEdge(target.data);
					destinationIndex = getDestinationIndex({
						cards: destinationColumn.cards,
						sourceTaskId,
						targetTaskId,
						closestEdge: closestEdge === "bottom" ? "bottom" : "top",
					});
				}

				const cardsWithoutSource = destinationColumn.cards.filter(
					(card) => card.id !== sourceTaskId,
				);
				const rank = getRankForDestination(
					cardsWithoutSource,
					destinationIndex,
				);
				if (
					sourceTask.status === destinationColumnId &&
					sourceTask.rank === rank
				) {
					return;
				}

				const queryKey = projectTasksQueryKey(projectId);
				const previousTasks = queryClient.getQueryData<Task[]>(queryKey);
				queryClient.setQueryData<Task[]>(queryKey, (tasks) =>
					tasks?.map((task) =>
						task.id === sourceTaskId
							? { ...task, status: destinationColumnId, rank }
							: task,
					),
				);

				updateTaskMutation.mutate(
					{
						projectId,
						taskId: sourceTaskId,
						taskUpdate: { status: destinationColumnId, rank },
					},
					{
						onError: () => {
							queryClient.setQueryData(queryKey, previousTasks);
						},
						onSettled: () => {
							void queryClient.invalidateQueries({ queryKey });
						},
					},
				);
			},
		});
	}, [columns, projectId, queryClient, tasksQuery.data, updateTaskMutation]);

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
								<BoardColumnView
									key={column.id}
									column={column}
									projectId={projectId}
									isActiveDropTarget={activeDropColumnId === column.id}
								>
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
										<BoardTaskCard
											key={card.id}
											card={card}
											columnId={column.id}
											isDragging={draggingTaskId === card.id}
											onDragStateChange={setDraggingTaskId}
										/>
									))}
								</BoardColumnView>
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
