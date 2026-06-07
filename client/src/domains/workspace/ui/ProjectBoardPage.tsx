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
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import {
	Bell,
	Calendar,
	ChevronRight,
	CircleHelp,
	Filter,
	GripVertical,
	LayoutDashboard,
	LogOut,
	MoreHorizontal,
	Plus,
	Search,
	Settings2,
	Share2,
	Target,
	TrendingUp,
	TriangleAlert,
	User,
	UserPlus,
} from "lucide-react";
import { type ReactNode, type Ref, useEffect, useRef, useState } from "react";

import {
	CurrentUserAuthError,
	type Task,
	useCurrentUserQuery,
	useKanaiApi,
} from "#/api/client";
import { useAuthBoundary } from "#/domains/auth/model/auth-boundary";
import {
	type BoardColumn,
	type ColumnId,
	getRankForDestination,
	getTasksWithMissingColumns,
	groupTasksByColumn,
	type InvalidBoardTask,
	rankBetween,
	useProjectTaskBoard,
} from "#/domains/workspace/model/useProjectTaskBoard";
import { WorkspaceIconButton } from "#/domains/workspace/ui/atoms/WorkspaceIconButton";
import { SidebarNavItem } from "#/domains/workspace/ui/molecules/SidebarNavItem";
import type { SidebarItem } from "#/domains/workspace/ui/types";

export {
	getRankForDestination,
	getTasksWithMissingColumns,
	groupTasksByColumn,
	rankBetween,
};

const sidebarItems: SidebarItem[] = [
	{ label: "Projects", icon: LayoutDashboard, active: true, to: "/" },
	{ label: "Team Goals", icon: Target },
	{ label: "Analytics", icon: TrendingUp },
];

type CardDropTargetData = {
	type: "card";
	taskId: string;
	columnId: ColumnId;
};

type ColumnDropTargetData = {
	type: "column";
	columnId: ColumnId;
};

type CardDropIndicator = {
	taskId: string;
	closestEdge: "top" | "bottom";
};

type ColumnAppendDropIndicator = {
	columnId: ColumnId;
};

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

export function getDestinationIndex({
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

function getDropColumnId(
	data: Record<string | symbol, unknown> | undefined,
): ColumnId | null {
	const columnId = data?.columnId;
	return typeof columnId === "string" ? columnId : null;
}

function getCardDropIndicator(
	data: Record<string | symbol, unknown> | undefined,
	sourceTaskId: string | null,
): CardDropIndicator | null {
	if (data?.type !== "card") {
		return null;
	}

	const taskId = data.taskId;
	if (typeof taskId !== "string" || taskId === sourceTaskId) {
		return null;
	}

	return {
		taskId,
		closestEdge: extractClosestEdge(data) === "bottom" ? "bottom" : "top",
	};
}

export function getColumnAppendDropIndicator(
	data: Record<string | symbol, unknown> | undefined,
): ColumnAppendDropIndicator | null {
	if (data?.type !== "column") {
		return null;
	}

	const columnId = data.columnId;
	return typeof columnId === "string" ? { columnId } : null;
}

function isTaskInBoardColumns(task: Task, columns: BoardColumn[]): boolean {
	return columns.some((column) => column.id === task.columnId);
}

function BoardTaskCard({
	card,
	columnId,
	isDragging,
	isDragDisabled,
	dropIndicatorEdge,
	onDragStateChange,
}: {
	card: Task;
	columnId: ColumnId;
	isDragging: boolean;
	isDragDisabled: boolean;
	dropIndicatorEdge: "top" | "bottom" | null;
	onDragStateChange: (taskId: string | null) => void;
}) {
	const ref = useRef<HTMLElement | null>(null);
	const dragHandleRef = useRef<HTMLButtonElement | null>(null);

	useEffect(() => {
		const element = ref.current;
		const dragHandle = dragHandleRef.current;
		if (!element || !dragHandle) {
			return;
		}
		if (isDragDisabled) {
			return;
		}

		return combine(
			draggable({
				element,
				dragHandle,
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
	}, [card.id, columnId, isDragDisabled, onDragStateChange]);

	return (
		<article
			ref={ref}
			className={[
				"relative rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 shadow-sm transition hover:border-[var(--outline)] hover:bg-[var(--surface-bright)]",
				isDragging
					? "scale-[0.99] opacity-45 ring-2 ring-[var(--primary)]"
					: isDragDisabled
						? "opacity-70"
						: "",
			].join(" ")}
		>
			{dropIndicatorEdge ? (
				<span
					aria-hidden="true"
					className={[
						"absolute left-4 right-4 h-1 rounded-full bg-[var(--primary)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_18%,transparent)]",
						dropIndicatorEdge === "top" ? "-top-2" : "-bottom-2",
					].join(" ")}
				/>
			) : null}
			<Link
				to="/projects/$projectId/tasks/$taskId"
				params={{ projectId: card.projectId, taskId: card.id }}
				aria-label={`Open task ${card.title}`}
				className="absolute inset-0 z-0 rounded-2xl text-inherit no-underline"
			/>
			<div className="pointer-events-none relative z-10">
				{card.tag || card.priority ? (
					<div className="flex items-start justify-between gap-3">
						<span
							className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getTagClass(card.priority)}`}
						>
							{card.tag || card.priority}
						</span>
						<TaskDragHandle
							ref={dragHandleRef}
							disabled={isDragDisabled}
							isDragging={isDragging}
						/>
					</div>
				) : null}
				{card.tag || card.priority ? (
					<p className="mt-3 text-sm leading-6 text-[var(--on-surface)]">
						{card.title}
					</p>
				) : (
					<div className="flex items-start justify-between gap-3">
						<p className="text-sm leading-6 text-[var(--on-surface)]">
							{card.title}
						</p>
						<TaskDragHandle
							ref={dragHandleRef}
							disabled={isDragDisabled}
							isDragging={isDragging}
						/>
					</div>
				)}
				{card.description ? (
					<p className="mt-2 text-xs leading-5 text-[var(--on-surface-variant)]">
						{card.description}
					</p>
				) : null}
				<div className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[var(--surface-variant)] px-2 py-1 text-xs font-semibold text-[var(--on-surface-variant)]">
					<Calendar className="h-3.5 w-3.5" />
					{getTaskMeta(card)}
				</div>
			</div>
		</article>
	);
}

function TaskDragHandle({
	ref,
	disabled,
	isDragging,
}: {
	ref: Ref<HTMLButtonElement>;
	disabled: boolean;
	isDragging: boolean;
}) {
	return (
		<button
			ref={ref}
			type="button"
			aria-label="Move task"
			title="Move task"
			disabled={disabled}
			className={[
				"pointer-events-auto relative z-20 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] text-[var(--on-surface-variant)] shadow-sm transition hover:bg-[var(--surface-container-high)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50",
				disabled ? "" : isDragging ? "cursor-grabbing" : "cursor-grab",
			].join(" ")}
		>
			<GripVertical className="h-4 w-4" aria-hidden="true" />
		</button>
	);
}

function BoardColumnView({
	column,
	projectId,
	isActiveDropTarget,
	isAppendDropTarget,
	isDropDisabled,
	children,
}: {
	column: BoardColumn;
	projectId: string;
	isActiveDropTarget: boolean;
	isAppendDropTarget: boolean;
	isDropDisabled: boolean;
	children: ReactNode;
}) {
	const ref = useRef<HTMLElement | null>(null);

	useEffect(() => {
		const element = ref.current;
		if (!element) {
			return;
		}
		if (isDropDisabled) {
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
	}, [column.id, isDropDisabled]);

	return (
		<section
			ref={ref}
			className={[
				"flex w-[340px] flex-shrink-0 flex-col rounded-[1.5rem] border border-transparent bg-[var(--surface-container)] p-4 transition",
				isActiveDropTarget
					? "border-[var(--primary)] bg-[color:color-mix(in_srgb,var(--primary-container)_34%,var(--surface-container))] ring-2 ring-[var(--primary)]"
					: "",
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

			<div
				aria-hidden="true"
				className={[
					"mt-4 rounded-2xl border border-dashed px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.18em] transition",
					isAppendDropTarget
						? "border-[var(--primary)] bg-[var(--primary-container)] text-[var(--on-primary-container)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_16%,transparent)]"
						: "border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)]",
				].join(" ")}
			>
				Drop here to append
			</div>

			<Link
				to="/projects/$projectId/tasks/new"
				params={{ projectId }}
				search={{ column_id: column.id }}
				className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 text-sm font-semibold text-[var(--on-surface-variant)] hover:bg-[var(--surface-bright)]"
			>
				<Plus className="h-4 w-4" />
				Add a task
			</Link>
		</section>
	);
}

function InvalidTasksView({ tasks }: { tasks: InvalidBoardTask[] }) {
	if (tasks.length === 0) {
		return null;
	}

	return (
		<section className="mb-4 min-w-[1100px] rounded-[1.5rem] border border-[var(--error-container)] bg-[var(--surface-container-lowest)] p-4 text-[var(--on-surface)]">
			<h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-[var(--on-error-container)]">
				<TriangleAlert className="h-4 w-4" /> Workflow Integrity Errors
			</h3>
			<p className="mt-2 text-sm text-[var(--on-surface-variant)]">
				These tasks are excluded from normal board columns until their workflow
				column references are repaired.
			</p>
			<div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{tasks.map(({ task, missingColumnId }) => (
					<Link
						key={task.id}
						to="/projects/$projectId/tasks/$taskId"
						params={{ projectId: task.projectId, taskId: task.id }}
						className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--error-container)] p-4 text-[var(--on-error-container)] no-underline"
					>
						<p className="text-sm font-semibold">{task.title}</p>
						<p className="mt-2 text-xs font-semibold">
							Workflow column missing: {missingColumnId}
						</p>
						<p className="mt-1 text-xs">
							This task references a project column that no longer exists.
						</p>
					</Link>
				))}
			</div>
		</section>
	);
}

export function ProjectBoardPage() {
	const auth = useAuthBoundary();
	const { projectId } = useParams({ from: "/projects/$projectId" });
	const api = useKanaiApi();
	const { data: currentUser } = useCurrentUserQuery();
	const projectQuery = useQuery(api.projects.get(projectId));
	const board = useProjectTaskBoard(projectId);
	const { columnsQuery, tasksQuery } = board;
	const { draggingTaskId, activeDropColumnId } = board.dragState;
	const { isMovePending, moveError } = board.moveState;
	const [cardDropIndicator, setCardDropIndicator] =
		useState<CardDropIndicator | null>(null);
	const [columnAppendDropIndicator, setColumnAppendDropIndicator] =
		useState<ColumnAppendDropIndicator | null>(null);
	const projectName = projectQuery.data?.name ?? "Project";
	const { columns, invalidTasks } = board;
	const isProjectAuthError = projectQuery.error instanceof CurrentUserAuthError;
	const isTasksAuthError = tasksQuery.error instanceof CurrentUserAuthError;
	const isColumnsAuthError = columnsQuery.error instanceof CurrentUserAuthError;
	const accountInitials = [
		getInitials(currentUser?.first_name),
		getInitials(currentUser?.last_name),
	]
		.join("")
		.trim();

	useEffect(() => {
		return monitorForElements({
			canMonitor: ({ source }) => !isMovePending && source.data.type === "card",
			onDropTargetChange: ({ location, source }) => {
				const activeTargetData = location.current.dropTargets[0]?.data;
				const sourceTaskId =
					typeof source.data.taskId === "string" ? source.data.taskId : null;

				board.dragState.setActiveDropColumnId(
					getDropColumnId(activeTargetData),
				);
				setCardDropIndicator(
					getCardDropIndicator(activeTargetData, sourceTaskId),
				);
				setColumnAppendDropIndicator(
					getColumnAppendDropIndicator(activeTargetData),
				);
			},
			onDrop: ({ source, location }) => {
				board.dragState.setActiveDropColumnId(null);
				board.dragState.setDraggingTaskId(null);
				setCardDropIndicator(null);
				setColumnAppendDropIndicator(null);

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
				if (
					!sourceTask ||
					!destinationColumn ||
					!isTaskInBoardColumns(sourceTask, columns)
				) {
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

				board.moveTask({
					taskId: sourceTaskId,
					toColumnId: destinationColumnId,
					beforeTaskId: cardsWithoutSource[destinationIndex - 1]?.id,
					afterTaskId: cardsWithoutSource[destinationIndex]?.id,
				});
			},
		});
	}, [board, columns, isMovePending, tasksQuery.data]);

	function handleLogout() {
		auth.logout();
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
								<button
									type="button"
									onClick={handleLogout}
									className="flex items-center gap-3 rounded-full px-4 py-3 text-left text-sm font-medium text-[var(--on-surface-variant)] hover:bg-[var(--surface-bright)]"
								>
									<LogOut className="h-4 w-4" />
									Logout
								</button>
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

						{columnsQuery.isError ? (
							<div className="mb-4 min-w-[1100px] rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4 text-sm text-[var(--on-surface-variant)]">
								{isColumnsAuthError
									? "Sign in again to load columns."
									: "Columns could not be loaded."}
								<button
									type="button"
									onClick={() => void columnsQuery.refetch()}
									className="ml-3 rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--on-primary)]"
								>
									Retry
								</button>
							</div>
						) : null}
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
						{moveError ? (
							<div className="mb-4 min-w-[1100px] rounded-xl border border-[var(--error-container)] bg-[var(--error-container)] p-4 text-sm font-semibold text-[var(--on-error-container)]">
								{moveError}
							</div>
						) : null}
						{!columnsQuery.isPending &&
						!columnsQuery.isError &&
						!tasksQuery.isPending &&
						!tasksQuery.isError ? (
							<InvalidTasksView tasks={invalidTasks} />
						) : null}
						<div className="flex min-w-[1100px] gap-6">
							{columnsQuery.isPending ? (
								<p className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 text-sm text-[var(--on-surface-variant)]">
									Loading columns...
								</p>
							) : null}
							{!columnsQuery.isError &&
								columns.map((column) => (
									<BoardColumnView
										key={column.id}
										column={column}
										projectId={projectId}
										isActiveDropTarget={activeDropColumnId === column.id}
										isAppendDropTarget={
											columnAppendDropIndicator?.columnId === column.id
										}
										isDropDisabled={isMovePending}
									>
										{tasksQuery.isPending ? (
											<p className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 text-sm text-[var(--on-surface-variant)]">
												Loading tasks...
											</p>
										) : null}
										{!tasksQuery.isPending &&
										!tasksQuery.isError &&
										column.cards.length === 0 ? (
											<p
												className={[
													"rounded-2xl border border-dashed p-4 text-sm transition",
													columnAppendDropIndicator?.columnId === column.id
														? "border-[var(--primary)] bg-[var(--primary-container)] text-[var(--on-primary-container)]"
														: "border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)]",
												].join(" ")}
											>
												No tasks in {column.title.toLowerCase()}.
											</p>
										) : null}
										{column.cards.map((card) => (
											<BoardTaskCard
												key={card.id}
												card={card}
												columnId={column.id}
												isDragging={draggingTaskId === card.id}
												isDragDisabled={isMovePending}
												dropIndicatorEdge={
													cardDropIndicator?.taskId === card.id
														? cardDropIndicator.closestEdge
														: null
												}
												onDragStateChange={board.dragState.setDraggingTaskId}
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
