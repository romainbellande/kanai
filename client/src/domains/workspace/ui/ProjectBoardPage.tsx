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
	ChevronRight,
	CircleHelp,
	Filter,
	GripVertical,
	LayoutDashboard,
	LogOut,
	MessageCircle,
	Pencil,
	Plus,
	Search,
	Settings2,
	Target,
	TrendingUp,
	TriangleAlert,
	User,
	UserPlus,
	X,
} from "lucide-react";
import {
	type ReactNode,
	type Ref,
	type UIEvent,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import {
	CurrentUserAuthError,
	getCurrentUserInitials,
	getUserDisplayLabel,
	getUserInitials,
	type Project,
	type Task,
	type UserProfile,
	useCurrentUserQuery,
	useKanaiApi,
	userSearchQueryOptions,
} from "#/api/client";
import { useAuthBoundary } from "#/domains/auth/model/auth-boundary";
import { useProjectChat } from "#/domains/workspace/model/useProjectChat";
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

const PROJECT_DESCRIPTION_FALLBACK = "No project description yet.";

type CardDropTargetData = {
	type: "card";
	taskId: string;
	columnId: ColumnId;
};

type ColumnDropTargetData = {
	type: "column";
	columnId: ColumnId;
};

type ColumnDragData = {
	type: "column-drag";
	columnId: ColumnId;
};

type CardDropIndicator = {
	taskId: string;
	closestEdge: "top" | "bottom";
};

type ColumnAppendDropIndicator = {
	columnId: ColumnId;
};

type ColumnInsertionIndicator = {
	columnId: ColumnId;
	edge: "left" | "right";
};

function getPriorityTagClass(priority: string): string {
	if (priority === "critical") {
		return "border border-[color:color-mix(in_srgb,var(--error,#ba1a1a)_34%,var(--outline-variant))] bg-[color:color-mix(in_srgb,var(--error,#ba1a1a)_14%,var(--surface-container-lowest))] text-[var(--error,#ba1a1a)]";
	}
	if (priority === "high") {
		return "border border-[color:color-mix(in_srgb,var(--tertiary-container)_34%,var(--outline-variant))] bg-[color:color-mix(in_srgb,var(--tertiary-container)_14%,var(--surface-container-lowest))] text-[var(--tertiary-container)]";
	}
	if (priority === "medium") {
		return "bg-[var(--primary-fixed)] text-[var(--on-primary-fixed)]";
	}
	return "border border-[var(--outline-variant)] bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]";
}

function getPriorityLabel(priority: string): string {
	return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function normalizeBoardPriority(priority: string | null): string | null {
	const normalizedPriority = priority?.trim().toLowerCase() ?? "";
	if (!normalizedPriority) {
		return null;
	}
	return normalizedPriority === "urgent" ? "critical" : normalizedPriority;
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

export function getColumnInsertionIndicator(
	data: Record<string | symbol, unknown> | undefined,
	sourceColumnId: ColumnId | null,
): ColumnInsertionIndicator | null {
	if (data?.type !== "column" || sourceColumnId === null) {
		return null;
	}

	const columnId = data.columnId;
	if (typeof columnId !== "string" || columnId === sourceColumnId) {
		return null;
	}

	return {
		columnId,
		edge: extractClosestEdge(data) === "right" ? "right" : "left",
	};
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
	const priority = normalizeBoardPriority(card.priority);
	const hasTags = Boolean(priority || card.tag);

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
				{hasTags ? (
					<div className="flex items-start justify-between gap-3">
						<div className="flex flex-wrap gap-2">
							{priority ? (
								<span
									className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getPriorityTagClass(priority)}`}
								>
									{getPriorityLabel(priority)}
								</span>
							) : null}
							{card.tag ? (
								<span className="inline-flex rounded-full bg-[var(--surface-container-high)] px-2 py-1 text-xs font-semibold text-[var(--on-surface-variant)]">
									{card.tag}
								</span>
							) : null}
						</div>
						<TaskDragHandle
							ref={dragHandleRef}
							disabled={isDragDisabled}
							isDragging={isDragging}
						/>
					</div>
				) : null}
				{hasTags ? (
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

function ColumnDragHandle({
	ref,
	disabled,
	isDragging,
	columnTitle,
}: {
	ref: Ref<HTMLButtonElement>;
	disabled: boolean;
	isDragging: boolean;
	columnTitle: string;
}) {
	return (
		<button
			ref={ref}
			type="button"
			aria-label={`Reorder ${columnTitle} column`}
			title="Reorder column"
			disabled={disabled}
			className={[
				"inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-45",
				disabled ? "" : isDragging ? "cursor-grabbing" : "cursor-grab",
			].join(" ")}
		>
			<GripVertical className="h-4 w-4" aria-hidden="true" />
		</button>
	);
}

function ColumnTitleWithDescription({
	title,
	description,
}: {
	title: string;
	description: string | null;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const hasDescription = description !== null && description.trim() !== "";

	if (!hasDescription) {
		return <h3 className="text-sm font-semibold">{title}</h3>;
	}

	return (
		<div className="relative">
			<button
				type="button"
				aria-expanded={isOpen}
				aria-label={`${title} column description`}
				className="rounded-md text-left text-sm font-semibold underline decoration-dotted underline-offset-4 hover:text-[var(--primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
				onClick={() => setIsOpen((current) => !current)}
				onMouseEnter={() => setIsOpen(true)}
				onMouseLeave={() => setIsOpen(false)}
				onFocus={() => setIsOpen(true)}
				onBlur={() => setIsOpen(false)}
			>
				{title}
			</button>
			{isOpen ? (
				<div
					role="tooltip"
					className="absolute left-0 top-full z-30 mt-2 max-w-[18rem] whitespace-pre-wrap break-words rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 text-sm font-medium leading-6 text-[var(--on-surface)] shadow-xl"
				>
					{description}
				</div>
			) : null}
		</div>
	);
}

function BoardColumnView({
	column,
	projectId,
	isActiveDropTarget,
	isAppendDropTarget,
	isDropDisabled,
	isProjectOwner,
	isColumnReorderAvailable,
	isColumnDragging,
	columnInsertionEdge,
	isColumnMoveDisabled,
	children,
}: {
	column: BoardColumn;
	projectId: string;
	isActiveDropTarget: boolean;
	isAppendDropTarget: boolean;
	isDropDisabled: boolean;
	isProjectOwner: boolean;
	isColumnReorderAvailable: boolean;
	isColumnDragging: boolean;
	columnInsertionEdge: "left" | "right" | null;
	isColumnMoveDisabled: boolean;
	children: ReactNode;
}) {
	const ref = useRef<HTMLElement | null>(null);
	const dragHandleRef = useRef<HTMLButtonElement | null>(null);

	useEffect(() => {
		const element = ref.current;
		const dragHandle = dragHandleRef.current;
		if (!element) {
			return;
		}

		const cleanupFns = [];
		if (!isDropDisabled) {
			cleanupFns.push(
				dropTargetForElements({
					element,
					canDrop: ({ source }) =>
						source.data.type === "card" || source.data.type === "column-drag",
					getData: ({ input }) =>
						attachClosestEdge(
							{
								type: "column",
								columnId: column.id,
							} satisfies ColumnDropTargetData,
							{ input, element, allowedEdges: ["left", "right"] },
						),
				}),
			);
		}

		if (dragHandle && isColumnReorderAvailable && !isColumnMoveDisabled) {
			cleanupFns.push(
				draggable({
					element,
					dragHandle,
					getInitialData: () =>
						({
							type: "column-drag",
							columnId: column.id,
						}) satisfies ColumnDragData,
				}),
			);
		}

		return cleanupFns.length > 0 ? combine(...cleanupFns) : undefined;
	}, [
		column.id,
		isColumnMoveDisabled,
		isColumnReorderAvailable,
		isDropDisabled,
	]);

	return (
		<section
			ref={ref}
			className={[
				"relative flex w-[340px] flex-shrink-0 flex-col rounded-[1.5rem] border border-transparent bg-[var(--surface-container)] p-4 transition",
				isActiveDropTarget
					? "border-[var(--primary)] bg-[color:color-mix(in_srgb,var(--primary-container)_34%,var(--surface-container))] ring-2 ring-[var(--primary)]"
					: "",
				isColumnDragging ? "opacity-55 ring-2 ring-[var(--primary)]" : "",
			].join(" ")}
		>
			{columnInsertionEdge ? (
				<span
					aria-hidden="true"
					className={[
						"absolute bottom-4 top-4 z-20 w-1 rounded-full bg-[var(--primary)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_18%,transparent)]",
						columnInsertionEdge === "left" ? "-left-3" : "-right-3",
					].join(" ")}
				/>
			) : null}
			<div className="mb-4 flex items-center justify-between gap-3 px-2">
				<div className="flex items-center gap-2">
					{isProjectOwner && isColumnReorderAvailable ? (
						<ColumnDragHandle
							ref={dragHandleRef}
							disabled={isColumnMoveDisabled}
							isDragging={isColumnDragging}
							columnTitle={column.title}
						/>
					) : null}
					<ColumnTitleWithDescription
						title={column.title}
						description={column.description}
					/>
					<span className="text-xs font-semibold text-[var(--on-surface-variant)]">
						{column.cards.length}
					</span>
				</div>
				{isProjectOwner ? (
					<div className="flex items-center gap-1">
						<Link
							to="/projects/$projectId/columns/$columnId"
							params={{ projectId, columnId: column.id }}
							aria-label={`Edit ${column.title} column`}
							title="Edit column"
							className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)] no-underline transition hover:bg-[var(--surface-container-high)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
						>
							<Pencil className="h-4 w-4" aria-hidden="true" />
						</Link>
					</div>
				) : null}
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

function getProjectAccessUserIds(project: Project | undefined): string[] {
	if (!project) {
		return [];
	}

	return [...new Set([...project.ownerIds, ...project.memberIds])];
}

function getProjectMemberAvatarLabel(user: UserProfile): string {
	return user.display_name?.trim() || user.external_id || user.id;
}

function getProjectMemberAvatarInitials(user: UserProfile): string {
	return getProjectMemberAvatarLabel(user)
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part.slice(0, 1).toUpperCase())
		.join("");
}

function ProjectMemberAvatarStack({
	project,
	users,
	onClick,
}: {
	project: Project | undefined;
	users: UserProfile[];
	onClick: () => void;
}) {
	const accessUserIds = getProjectAccessUserIds(project);
	if (accessUserIds.length === 0) {
		return null;
	}

	const usersById = new Map(users.map((user) => [user.id, user]));
	const visibleUserIds = accessUserIds.slice(0, 5);
	const overflowCount = accessUserIds.length - visibleUserIds.length;

	return (
		<button
			type="button"
			aria-label="View project members"
			onClick={onClick}
			className="flex -space-x-2 rounded-full px-1 py-1 transition hover:bg-[var(--surface-container-high)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
		>
			{visibleUserIds.map((userId) => {
				const user = usersById.get(userId);
				const label = user ? getProjectMemberAvatarLabel(user) : userId;

				return (
					<span
						key={userId}
						title={label}
						className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--background)] bg-[var(--primary-container)] text-xs font-bold text-[var(--on-primary-container)] shadow-sm"
					>
						{user ? (
							getProjectMemberAvatarInitials(user)
						) : (
							<User className="h-4 w-4" />
						)}
					</span>
				);
			})}
			{overflowCount > 0 ? (
				<span className="flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-[var(--background)] bg-[var(--surface-container-highest)] px-2 text-xs font-bold text-[var(--on-surface-variant)] shadow-sm">
					+{overflowCount}
				</span>
			) : null}
		</button>
	);
}

function ProjectMembersModal({
	isOpen,
	onClose,
	onAddMember,
	project,
	users,
	isLoading,
	isError,
}: {
	isOpen: boolean;
	onClose: () => void;
	onAddMember: (userId: string) => Promise<void>;
	project: Project | undefined;
	users: UserProfile[];
	isLoading: boolean;
	isError: boolean;
}) {
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
	const [selectedUsers, setSelectedUsers] = useState<Map<string, UserProfile>>(
		() => new Map(),
	);
	const [addedUsers, setAddedUsers] = useState<Map<string, UserProfile>>(
		() => new Map(),
	);
	const [isAddingMembers, setIsAddingMembers] = useState(false);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const trimmedSearchQuery = searchQuery.trim();

	useEffect(() => {
		if (!isOpen) {
			setSearchQuery("");
			setDebouncedSearchQuery("");
			setAddedUsers(new Map());
			setSuccessMessage(null);
			setErrorMessage(null);
			return;
		}

		const timerId = window.setTimeout(() => {
			setDebouncedSearchQuery(trimmedSearchQuery);
		}, 300);

		return () => window.clearTimeout(timerId);
	}, [isOpen, trimmedSearchQuery]);

	const searchUsersQuery = useQuery(
		userSearchQueryOptions(
			debouncedSearchQuery,
			20,
			isOpen && debouncedSearchQuery.length >= 2,
		),
	);

	if (!isOpen) {
		return null;
	}

	const ownerIds = project?.ownerIds ?? [];
	const memberIds = project?.memberIds ?? [];
	const usersById = new Map([
		...users.map((user) => [user.id, user] as const),
		...addedUsers,
	]);
	const accessUserIds = new Set([...ownerIds, ...memberIds]);
	const addedRows = [...addedUsers.values()].filter(
		(user) => !accessUserIds.has(user.id),
	);
	const accessRows = [
		...[...new Set([...ownerIds, ...memberIds])].map((userId) => ({
			isOwner: ownerIds.includes(userId),
			user: usersById.get(userId),
			userId,
		})),
		...addedRows.map((user) => ({ isOwner: false, user, userId: user.id })),
	];
	const searchRows = (searchUsersQuery.data ?? []).filter(
		(user) => !accessUserIds.has(user.id),
	);
	const selectedCount = selectedUsers.size;

	function handleSelectionChange(user: UserProfile, isSelected: boolean) {
		setSuccessMessage(null);
		setErrorMessage(null);
		setSelectedUsers((previous) => {
			const next = new Map(previous);
			if (isSelected) {
				next.set(user.id, user);
			} else {
				next.delete(user.id);
			}
			return next;
		});
	}

	async function handleAddSelected() {
		if (selectedUsers.size === 0 || isAddingMembers) {
			return;
		}

		setIsAddingMembers(true);
		setSuccessMessage(null);
		setErrorMessage(null);
		const selected = [...selectedUsers.values()];
		const successfulIds: string[] = [];
		const failedUsers: UserProfile[] = [];

		for (const user of selected) {
			try {
				await onAddMember(user.id);
				successfulIds.push(user.id);
			} catch {
				failedUsers.push(user);
			}
		}

		setSelectedUsers((previous) => {
			const next = new Map(previous);
			for (const userId of successfulIds) {
				next.delete(userId);
			}
			return next;
		});
		setAddedUsers((previous) => {
			const next = new Map(previous);
			for (const user of selected) {
				if (successfulIds.includes(user.id)) {
					next.set(user.id, user);
				}
			}
			return next;
		});

		if (successfulIds.length > 0) {
			setSuccessMessage(
				`Added ${successfulIds.length} ${successfulIds.length === 1 ? "member" : "members"}.`,
			);
		}
		if (failedUsers.length > 0) {
			setErrorMessage(
				`Could not add ${failedUsers.map(getUserDisplayLabel).join(", ")}.`,
			);
		}
		setIsAddingMembers(false);
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
			<button
				type="button"
				aria-label="Close member modal backdrop"
				onClick={onClose}
				className="absolute inset-0 bg-black/30 backdrop-blur-sm"
			/>
			<section
				aria-modal="true"
				aria-labelledby="project-members-title"
				role="dialog"
				className="relative w-full max-w-xl rounded-[1.75rem] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-6 text-[var(--on-surface)] shadow-2xl"
			>
				<div className="flex items-start justify-between gap-4">
					<div>
						<p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--on-surface-variant)]">
							Project access
						</p>
						<h2
							id="project-members-title"
							className="mt-2 font-display text-2xl font-bold tracking-tight"
						>
							Invite members
						</h2>
						<p className="mt-2 text-sm text-[var(--on-surface-variant)]">
							Review everyone who currently has access to{" "}
							{project?.name ?? "this project"}.
						</p>
					</div>
					<button
						type="button"
						aria-label="Close member modal"
						onClick={onClose}
						className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[var(--outline-variant)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="mt-6 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
					<div className="mb-6 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4">
						<label
							className="text-sm font-bold"
							htmlFor="project-member-search"
						>
							Search Kanai users
						</label>
						<div className="mt-3 flex items-center gap-2 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2 focus-within:ring-2 focus-within:ring-[var(--primary)]">
							<Search className="h-4 w-4 flex-shrink-0 text-[var(--on-surface-variant)]" />
							<input
								id="project-member-search"
								type="search"
								value={searchQuery}
								onChange={(event) => setSearchQuery(event.currentTarget.value)}
								placeholder="Search by display name or external identity"
								className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-[var(--on-surface-variant)]"
							/>
						</div>
						{trimmedSearchQuery.length < 2 ? (
							<p className="mt-3 text-sm text-[var(--on-surface-variant)]">
								Enter at least 2 characters to search.
							</p>
						) : null}
						{searchUsersQuery.isPending && debouncedSearchQuery.length >= 2 ? (
							<p className="mt-3 text-sm text-[var(--on-surface-variant)]">
								Searching users...
							</p>
						) : null}
						{searchUsersQuery.isError ? (
							<p className="mt-3 rounded-xl border border-[var(--error-container)] bg-[var(--error-container)] p-3 text-sm font-semibold text-[var(--on-error-container)]">
								User search could not be loaded.
							</p>
						) : null}
						{debouncedSearchQuery.length >= 2 &&
						!searchUsersQuery.isPending &&
						!searchUsersQuery.isError &&
						searchRows.length === 0 ? (
							<p className="mt-3 text-sm text-[var(--on-surface-variant)]">
								No matching users available to invite.
							</p>
						) : null}
						{searchRows.length > 0 ? (
							<ul className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
								{searchRows.map((user) => {
									const label = getUserDisplayLabel(user);
									const checkboxId = `invite-user-${user.id}`;

									return (
										<li key={user.id}>
											<label
												htmlFor={checkboxId}
												className="flex cursor-pointer items-center gap-3 rounded-2xl bg-[var(--surface-container-low)] p-3 hover:bg-[var(--surface-container-high)]"
											>
												<input
													id={checkboxId}
													type="checkbox"
													checked={selectedUsers.has(user.id)}
													onChange={(event) =>
														handleSelectionChange(
															user,
															event.currentTarget.checked,
														)
													}
													className="h-4 w-4 flex-shrink-0 accent-[var(--primary)]"
												/>
												<span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--secondary-container)] text-xs font-bold text-[var(--on-secondary-container)]">
													{getUserInitials(user)}
												</span>
												<span className="min-w-0">
													<span className="block truncate text-sm font-semibold">
														{label}
													</span>
													<span className="block truncate text-xs text-[var(--on-surface-variant)]">
														{user.external_id}
													</span>
												</span>
											</label>
										</li>
									);
								})}
							</ul>
						) : null}
						<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--outline-variant)] pt-4">
							<p className="text-sm font-semibold text-[var(--on-surface-variant)]">
								{selectedCount} selected
							</p>
							<button
								type="button"
								disabled={selectedCount === 0 || isAddingMembers}
								onClick={() => void handleAddSelected()}
								className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-bold text-[var(--on-primary)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{isAddingMembers
									? "Adding..."
									: `Add selected (${selectedCount})`}
							</button>
						</div>
						{successMessage ? (
							<p className="mt-3 rounded-xl bg-[var(--primary-container)] p-3 text-sm font-semibold text-[var(--on-primary-container)]">
								{successMessage}
							</p>
						) : null}
						{errorMessage ? (
							<p className="mt-3 rounded-xl border border-[var(--error-container)] bg-[var(--error-container)] p-3 text-sm font-semibold text-[var(--on-error-container)]">
								{errorMessage}
							</p>
						) : null}
					</div>
					<div className="flex items-center justify-between gap-3">
						<h3 className="text-sm font-bold">People with access</h3>
						<span className="text-xs font-semibold text-[var(--on-surface-variant)]">
							{accessRows.length} total
						</span>
					</div>

					{isLoading ? (
						<p className="mt-4 text-sm text-[var(--on-surface-variant)]">
							Loading members...
						</p>
					) : null}
					{isError ? (
						<p className="mt-4 rounded-xl border border-[var(--error-container)] bg-[var(--error-container)] p-3 text-sm font-semibold text-[var(--on-error-container)]">
							Project members could not be loaded.
						</p>
					) : null}
					{!isLoading && !isError && accessRows.length === 0 ? (
						<p className="mt-4 text-sm text-[var(--on-surface-variant)]">
							No project members found.
						</p>
					) : null}
					{!isError && accessRows.length > 0 ? (
						<ul className="mt-4 space-y-3">
							{accessRows.map(({ isOwner, user, userId }) => {
								const label = user ? getUserDisplayLabel(user) : userId;

								return (
									<li
										key={userId}
										className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-container-lowest)] p-3"
									>
										<div className="flex min-w-0 items-center gap-3">
											<span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary-container)] text-sm font-bold text-[var(--on-primary-container)]">
												{user ? (
													getUserInitials(user)
												) : (
													<User className="h-4 w-4" />
												)}
											</span>
											<div className="min-w-0">
												<p className="truncate text-sm font-semibold">
													{label}
												</p>
												<p className="truncate text-xs text-[var(--on-surface-variant)]">
													{user?.external_id ?? userId}
												</p>
											</div>
										</div>
										{isOwner ? (
											<span className="rounded-full bg-[var(--primary-container)] px-2.5 py-1 text-xs font-bold text-[var(--on-primary-container)]">
												Owner
											</span>
										) : null}
									</li>
								);
							})}
						</ul>
					) : null}
				</div>
			</section>
		</div>
	);
}

function formatChatTimestamp(date: Date): string {
	return new Intl.DateTimeFormat(undefined, {
		hour: "numeric",
		minute: "2-digit",
	}).format(date);
}

function formatChatTimestampTitle(date: Date): string {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

function ProjectChatPanel({
	chat,
	onClose,
	projectName,
}: {
	chat: ReturnType<typeof useProjectChat>;
	onClose: () => void;
	projectName: string;
}) {
	const messagesContainerRef = useRef<HTMLDivElement | null>(null);
	const previousFirstMessageIdRef = useRef<string | null>(null);
	const previousLastMessageIdRef = useRef<string | null>(null);
	const previousScrollHeightRef = useRef<number | null>(null);
	const wasNearBottomRef = useRef(true);
	const [hasUnseenMessages, setHasUnseenMessages] = useState(false);
	const firstMessageId = chat.messages[0]?.id ?? null;
	const lastMessageId = chat.messages.at(-1)?.id ?? null;

	useLayoutEffect(() => {
		const container = messagesContainerRef.current;
		if (!container) {
			return;
		}

		const previousFirstMessageId = previousFirstMessageIdRef.current;
		const previousLastMessageId = previousLastMessageIdRef.current;
		const didPrependOlderMessages =
			Boolean(previousFirstMessageId) &&
			firstMessageId !== previousFirstMessageId;
		const didAppendMessages =
			Boolean(previousLastMessageId) && lastMessageId !== previousLastMessageId;

		if (didPrependOlderMessages) {
			const previousScrollHeight = previousScrollHeightRef.current;
			if (previousScrollHeight !== null) {
				container.scrollTop += container.scrollHeight - previousScrollHeight;
			}
		}

		if (
			!didPrependOlderMessages &&
			didAppendMessages &&
			wasNearBottomRef.current
		) {
			container.scrollTop = container.scrollHeight;
			setHasUnseenMessages(false);
		} else if (didAppendMessages && !wasNearBottomRef.current) {
			setHasUnseenMessages(true);
		}

		if (!previousLastMessageId && lastMessageId) {
			container.scrollTop = container.scrollHeight;
		}

		previousFirstMessageIdRef.current = firstMessageId;
		previousLastMessageIdRef.current = lastMessageId;
		previousScrollHeightRef.current = null;
		wasNearBottomRef.current = isNearChatBottom(container);
	}, [firstMessageId, lastMessageId]);

	if (!chat.isOpen) {
		return null;
	}

	function jumpToLatestMessages() {
		const container = messagesContainerRef.current;
		if (!container) {
			return;
		}

		container.scrollTop = container.scrollHeight;
		wasNearBottomRef.current = true;
		setHasUnseenMessages(false);
	}

	function handleMessagesScroll(event: UIEvent<HTMLDivElement>) {
		wasNearBottomRef.current = isNearChatBottom(event.currentTarget);
		if (wasNearBottomRef.current) {
			setHasUnseenMessages(false);
		}

		if (
			event.currentTarget.scrollTop <= 64 &&
			chat.hasOlderMessages &&
			!chat.isLoadingOlderMessages
		) {
			previousScrollHeightRef.current = event.currentTarget.scrollHeight;
			void chat.loadOlderMessages();
		}
	}

	return (
		<div className="fixed inset-0 z-40 bg-black/30 lg:bg-transparent">
			<aside
				aria-label="Project chat"
				role="dialog"
				aria-modal="true"
				className="absolute inset-0 flex flex-col bg-[var(--surface-container-lowest)] shadow-2xl lg:left-auto lg:w-[30rem] lg:border-l lg:border-[var(--outline-variant)]"
			>
				<header className="flex items-start justify-between gap-4 border-b border-[var(--outline-variant)] px-5 py-4">
					<div>
						<p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
							Project chat
						</p>
						<h2 className="mt-1 font-display text-xl font-bold">
							{projectName}
						</h2>
						{chat.isReconnecting ? (
							<p className="mt-2 text-xs font-semibold text-[var(--on-surface-variant)]">
								Reconnecting to chat...
							</p>
						) : null}
					</div>
					<button
						type="button"
						aria-label="Close chat"
						onClick={onClose}
						className="rounded-full p-2 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
					>
						<X className="h-5 w-5" />
					</button>
				</header>

				<div
					data-testid="project-chat-messages"
					ref={messagesContainerRef}
					className="flex-1 overflow-y-auto px-5 py-4"
					onScroll={handleMessagesScroll}
				>
					{chat.isLoadingOlderMessages ? (
						<p className="mb-4 text-center text-xs font-semibold text-[var(--on-surface-variant)]">
							Loading older messages...
						</p>
					) : null}
					{chat.isLoading ? (
						<p className="rounded-2xl bg-[var(--surface-container-low)] p-4 text-sm text-[var(--on-surface-variant)]">
							Loading recent messages...
						</p>
					) : null}
					{chat.isError ? (
						<div className="rounded-2xl border border-[var(--error-container)] bg-[var(--error-container)] p-4 text-sm font-semibold text-[var(--on-error-container)]">
							Chat history could not be loaded.
							<button
								type="button"
								onClick={() => void chat.refetch()}
								className="ml-3 rounded-full bg-[var(--surface-container-lowest)] px-3 py-1.5 text-xs text-[var(--on-surface)]"
							>
								Retry
							</button>
						</div>
					) : null}
					{!chat.isLoading && !chat.isError && chat.messages.length === 0 ? (
						<p className="rounded-2xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4 text-sm text-[var(--on-surface-variant)]">
							No messages yet.
						</p>
					) : null}
					{chat.messages.length > 0 ? (
						<ol className="space-y-4">
							{chat.messages.map((message) => (
								<li key={message.id} className="flex gap-3">
									<span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary-container)] text-sm font-bold text-[var(--on-primary-container)]">
										{message.author.initials}
									</span>
									<div className="min-w-0 flex-1 rounded-2xl bg-[var(--surface-container-low)] px-4 py-3">
										<div className="flex flex-wrap items-baseline justify-between gap-2">
											<p className="font-semibold">
												{message.author.displayName}
												{message.author.deleted ? " (deleted)" : ""}
											</p>
											<time
												dateTime={message.createdAt.toISOString()}
												title={formatChatTimestampTitle(message.createdAt)}
												className="text-xs font-semibold text-[var(--on-surface-variant)]"
											>
												{formatChatTimestamp(message.createdAt)}
											</time>
										</div>
										<p className="mt-2 whitespace-pre-wrap text-sm leading-6">
											{message.body}
										</p>
									</div>
								</li>
							))}
						</ol>
					) : null}
					{hasUnseenMessages ? (
						<div className="sticky bottom-3 mt-4 flex justify-center">
							<button
								type="button"
								onClick={jumpToLatestMessages}
								className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-bold text-[var(--on-primary)] shadow-lg transition hover:brightness-105"
							>
								New messages
							</button>
						</div>
					) : null}
				</div>
				<ChatComposer chat={chat} />
			</aside>
		</div>
	);
}

function isNearChatBottom(container: HTMLDivElement): boolean {
	return (
		container.scrollHeight - container.scrollTop - container.clientHeight <= 96
	);
}

function ChatComposer({ chat }: { chat: ReturnType<typeof useProjectChat> }) {
	const [draft, setDraft] = useState("");
	const [pendingClientMessageId, setPendingClientMessageId] = useState<
		string | null
	>(null);
	const trimmedDraft = draft.trim();
	const canSend =
		chat.isConnected && trimmedDraft.length > 0 && trimmedDraft.length <= 4_000;

	useEffect(() => {
		if (
			pendingClientMessageId !== null &&
			chat.lastCreatedClientMessageId === pendingClientMessageId
		) {
			setDraft("");
			setPendingClientMessageId(null);
		}
	}, [chat.lastCreatedClientMessageId, pendingClientMessageId]);

	function sendDraft() {
		const clientMessageId = chat.sendMessage(draft);
		if (clientMessageId !== null) {
			setPendingClientMessageId(clientMessageId);
		}
	}

	return (
		<footer className="border-t border-[var(--outline-variant)] px-5 py-4">
			{chat.sendError ? (
				<p className="mb-3 rounded-2xl bg-[var(--error-container)] px-4 py-2 text-sm font-semibold text-[var(--on-error-container)]">
					{chat.sendError}
				</p>
			) : null}
			<label className="sr-only" htmlFor="project-chat-message">
				Message
			</label>
			<textarea
				id="project-chat-message"
				value={draft}
				onChange={(event) => setDraft(event.currentTarget.value)}
				maxLength={4_000}
				onKeyDown={(event) => {
					if (event.key === "Enter" && !event.shiftKey) {
						event.preventDefault();
						sendDraft();
					}
				}}
				placeholder={
					chat.isConnected ? "Write a message..." : "Connecting to chat..."
				}
				disabled={!chat.isConnected}
				className="min-h-24 w-full resize-none rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm leading-6 text-[var(--on-surface)] outline-none transition placeholder:text-[var(--on-surface-variant)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
			/>
			<div className="mt-3 flex items-center justify-between gap-3">
				<p className="text-xs font-semibold text-[var(--on-surface-variant)]">
					{chat.isConnected
						? `${trimmedDraft.length}/4000. Enter to send, Shift+Enter for a new line.`
						: "Sending is disabled while disconnected."}
				</p>
				<button
					type="button"
					onClick={sendDraft}
					disabled={!canSend}
					className="rounded-full bg-[var(--primary)] px-5 py-2 text-sm font-bold text-[var(--on-primary)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Send
				</button>
			</div>
		</footer>
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
	const { isColumnReorderPending, columnReorderError } =
		board.columnReorderState;
	const [cardDropIndicator, setCardDropIndicator] =
		useState<CardDropIndicator | null>(null);
	const [columnAppendDropIndicator, setColumnAppendDropIndicator] =
		useState<ColumnAppendDropIndicator | null>(null);
	const [draggingColumnId, setDraggingColumnId] = useState<ColumnId | null>(
		null,
	);
	const [columnInsertionIndicator, setColumnInsertionIndicator] =
		useState<ColumnInsertionIndicator | null>(null);
	const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
	const [isChatOpen, setIsChatOpen] = useState(false);
	const [isMetadataEditing, setIsMetadataEditing] = useState(false);
	const [metadataName, setMetadataName] = useState("");
	const [metadataDescription, setMetadataDescription] = useState("");
	const [metadataError, setMetadataError] = useState<string | null>(null);
	const [metadataSuccess, setMetadataSuccess] = useState<string | null>(null);
	const [isMetadataSaving, setIsMetadataSaving] = useState(false);
	const metadataSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const projectName = projectQuery.data?.name ?? "Project";
	const projectDescription = projectQuery.data?.description?.trim()
		? projectQuery.data.description
		: PROJECT_DESCRIPTION_FALLBACK;
	const chat = useProjectChat(projectId, isChatOpen);
	const accessUserIds = getProjectAccessUserIds(projectQuery.data);
	const accessUsersQuery = useQuery(
		api.users.projectAccess(projectId, accessUserIds, accessUserIds.length > 0),
	);
	const { columns, invalidTasks } = board;
	const isProjectOwner = Boolean(
		currentUser && projectQuery.data?.ownerIds.includes(currentUser.id),
	);
	const isProjectAuthError = projectQuery.error instanceof CurrentUserAuthError;
	const isTasksAuthError = tasksQuery.error instanceof CurrentUserAuthError;
	const isColumnsAuthError = columnsQuery.error instanceof CurrentUserAuthError;
	const accountInitials = getCurrentUserInitials(currentUser);
	const isBoardMutationPending = isMovePending || isColumnReorderPending;

	useEffect(() => {
		return () => {
			if (metadataSuccessTimerRef.current) {
				clearTimeout(metadataSuccessTimerRef.current);
			}
		};
	}, []);

	useEffect(() => {
		return monitorForElements({
			canMonitor: ({ source }) =>
				!isBoardMutationPending && source.data.type === "card",
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
	}, [board, columns, isBoardMutationPending, tasksQuery.data]);

	useEffect(() => {
		return monitorForElements({
			canMonitor: ({ source }) =>
				!isBoardMutationPending && source.data.type === "column-drag",
			onDragStart: ({ source }) => {
				setDraggingColumnId(
					typeof source.data.columnId === "string"
						? source.data.columnId
						: null,
				);
			},
			onDropTargetChange: ({ location, source }) => {
				const sourceColumnId =
					typeof source.data.columnId === "string"
						? source.data.columnId
						: null;
				const activeTargetData = location.current.dropTargets[0]?.data;

				setColumnInsertionIndicator(
					getColumnInsertionIndicator(activeTargetData, sourceColumnId),
				);
			},
			onDrop: ({ source, location }) => {
				setDraggingColumnId(null);
				setColumnInsertionIndicator(null);

				const sourceColumnId = source.data.columnId;
				if (typeof sourceColumnId !== "string") {
					return;
				}

				const targetData = location.current.dropTargets[0]?.data;
				const insertionIndicator = getColumnInsertionIndicator(
					targetData,
					sourceColumnId,
				);
				if (!insertionIndicator) {
					return;
				}

				board.reorderColumn({
					sourceColumnId,
					targetColumnId: insertionIndicator.columnId,
					placement: insertionIndicator.edge === "left" ? "before" : "after",
				});
			},
		});
	}, [board, isBoardMutationPending]);

	function handleLogout() {
		auth.logout();
	}

	function handleInviteClick() {
		if (isProjectOwner) {
			setIsMembersModalOpen(true);
		}
	}

	function handleEditMetadataClick() {
		if (!isProjectOwner || !projectQuery.data) {
			return;
		}

		setMetadataName(projectQuery.data.name);
		setMetadataDescription(projectQuery.data.description ?? "");
		setMetadataError(null);
		setMetadataSuccess(null);
		setIsMetadataEditing(true);
	}

	function handleCancelMetadataEdit() {
		setIsMetadataEditing(false);
		setMetadataError(null);
	}

	async function handleSaveMetadata() {
		const trimmedName = metadataName.trim();
		if (trimmedName === "") {
			setMetadataError("Project title is required.");
			return;
		}

		setIsMetadataSaving(true);
		setMetadataError(null);
		try {
			await api.projects.update(projectId, {
				name: trimmedName,
				description:
					metadataDescription.trim() === "" ? null : metadataDescription,
			});
			setIsMetadataEditing(false);
			setMetadataSuccess("Project details saved.");
			if (metadataSuccessTimerRef.current) {
				clearTimeout(metadataSuccessTimerRef.current);
			}
			metadataSuccessTimerRef.current = setTimeout(() => {
				setMetadataSuccess(null);
				metadataSuccessTimerRef.current = null;
			}, 3_000);
		} catch {
			setMetadataError("Project details could not be saved.");
		} finally {
			setIsMetadataSaving(false);
		}
	}

	async function handleAddProjectMember(userId: string) {
		await api.projects.addMember(projectId, userId);
	}

	const isColumnReorderAvailable = columns.length > 1;

	return (
		<main className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--on-surface)]">
			<ProjectMembersModal
				isOpen={isMembersModalOpen}
				onClose={() => setIsMembersModalOpen(false)}
				onAddMember={handleAddProjectMember}
				project={projectQuery.data}
				users={accessUsersQuery.data ?? []}
				isLoading={accessUsersQuery.isPending && accessUserIds.length > 0}
				isError={accessUsersQuery.isError}
			/>
			<ProjectChatPanel
				chat={chat}
				onClose={() => setIsChatOpen(false)}
				projectName={projectName}
			/>
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
							<div className="mt-3 flex items-start justify-between gap-4">
								<div className="min-w-0">
									<h2 className="font-display text-3xl font-bold tracking-tight text-[var(--on-surface)] sm:text-[2.375rem]">
										{projectQuery.data
											? `Main Board: ${projectQuery.data.name}`
											: "Main Board"}
									</h2>
									<p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-[var(--on-surface-variant)]">
										{projectDescription}
									</p>
									{metadataSuccess ? (
										<output className="mt-3 text-sm font-semibold text-[var(--primary)]">
											{metadataSuccess}
										</output>
									) : null}
								</div>
								<div className="flex items-center gap-3">
									{isProjectOwner && projectQuery.data ? (
										<button
											type="button"
											onClick={handleEditMetadataClick}
											className="inline-flex items-center gap-2 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-bright)]"
										>
											<Pencil className="h-4 w-4" />
											Edit project metadata
										</button>
									) : null}
									<button
										type="button"
										onClick={() => setIsChatOpen(true)}
										className="inline-flex items-center gap-2 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-bright)]"
									>
										<MessageCircle className="h-4 w-4" />
										Chat
									</button>
									<ProjectMemberAvatarStack
										project={projectQuery.data}
										users={accessUsersQuery.data ?? []}
										onClick={() => setIsMembersModalOpen(true)}
									/>
									<button
										type="button"
										className="inline-flex items-center gap-2 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-bright)]"
									>
										<Filter className="h-4 w-4" />
										Filter
									</button>
									<button
										type="button"
										disabled={!isProjectOwner}
										onClick={handleInviteClick}
										className="inline-flex items-center gap-2 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-bright)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--surface-container-lowest)]"
									>
										<UserPlus className="h-4 w-4" />
										Invite
									</button>
								</div>
							</div>
							{isMetadataEditing ? (
								<form
									aria-label="Edit project metadata"
									className="mt-4 max-w-3xl rounded-[1.5rem] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 shadow-sm"
									onSubmit={(event) => {
										event.preventDefault();
										void handleSaveMetadata();
									}}
								>
									<div className="grid gap-4">
										<label className="grid gap-2 text-sm font-semibold text-[var(--on-surface)]">
											Project title
											<input
												value={metadataName}
												onChange={(event) =>
													setMetadataName(event.currentTarget.value)
												}
												className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]"
											/>
										</label>
										<label className="grid gap-2 text-sm font-semibold text-[var(--on-surface)]">
											Project description
											<textarea
												value={metadataDescription}
												onChange={(event) =>
													setMetadataDescription(event.currentTarget.value)
												}
												placeholder="Describe the project context"
												className="min-h-28 resize-y rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-[var(--on-surface-variant)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]"
											/>
										</label>
									</div>
									{metadataError ? (
										<p
											className="mt-3 text-sm font-semibold text-[var(--error)]"
											role="alert"
										>
											{metadataError}
										</p>
									) : null}
									<div className="mt-4 flex flex-wrap items-center gap-3">
										<button
											type="submit"
											disabled={isMetadataSaving}
											className="rounded-full bg-[var(--primary)] px-5 py-2 text-sm font-bold text-[var(--on-primary)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
										>
											{isMetadataSaving ? "Saving..." : "Save details"}
										</button>
										<button
											type="button"
											onClick={handleCancelMetadataEdit}
											disabled={isMetadataSaving}
											className="rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-5 py-2 text-sm font-bold hover:bg-[var(--surface-bright)] disabled:cursor-not-allowed disabled:opacity-50"
										>
											Cancel
										</button>
									</div>
								</form>
							) : null}
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
						{moveError || columnReorderError ? (
							<div className="mb-4 min-w-[1100px] rounded-xl border border-[var(--error-container)] bg-[var(--error-container)] p-4 text-sm font-semibold text-[var(--on-error-container)]">
								{moveError ?? columnReorderError}
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
										isDropDisabled={isBoardMutationPending}
										isProjectOwner={isProjectOwner}
										isColumnReorderAvailable={isColumnReorderAvailable}
										isColumnDragging={draggingColumnId === column.id}
										columnInsertionEdge={
											columnInsertionIndicator?.columnId === column.id
												? columnInsertionIndicator.edge
												: null
										}
										isColumnMoveDisabled={isBoardMutationPending}
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
												isDragDisabled={isBoardMutationPending}
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

							{isProjectOwner ? (
								<Link
									to="/projects/$projectId/columns/new"
									params={{ projectId }}
									className="flex min-h-32 w-[340px] flex-shrink-0 items-center justify-center gap-2 rounded-[1.5rem] border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 text-sm font-semibold text-[var(--on-surface-variant)] no-underline hover:bg-[var(--surface-bright)]"
								>
									<Plus className="h-4 w-4" />
									Add another list
								</Link>
							) : null}
						</div>
					</div>
				</section>
			</div>
		</main>
	);
}
