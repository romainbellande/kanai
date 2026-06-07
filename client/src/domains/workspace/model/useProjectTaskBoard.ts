import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { type ProjectColumn, type Task, useKanaiApi } from "#/api/client";

export type ColumnId = string;

export type BoardColumn = {
	id: ColumnId;
	title: string;
	cards: Task[];
};

export type InvalidBoardTask = {
	task: Task;
	missingColumnId: ColumnId;
};

export type MoveTaskInput = {
	taskId: string;
	toColumnId: ColumnId;
	beforeTaskId?: string;
	afterTaskId?: string;
};

const moveFailureMessage = "Task move failed. Your board was restored.";

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

export function groupTasksByColumn(
	tasks: Task[],
	projectId: string,
	projectColumns: ProjectColumn[],
): BoardColumn[] {
	const columns: BoardColumn[] = projectColumns.map((column) => ({
		id: column.id,
		title: column.name,
		cards: [],
	}));

	for (const task of tasks) {
		if (task.projectId !== projectId) {
			continue;
		}

		const column = columns.find(({ id }) => id === task.columnId);

		column?.cards.push(task);
	}

	return columns.map((column) => ({
		...column,
		cards: column.cards.sort(compareTasksByRank),
	}));
}

export function getTasksWithMissingColumns(
	tasks: Task[],
	projectId: string,
	projectColumns: ProjectColumn[],
): InvalidBoardTask[] {
	const columnIds = new Set(projectColumns.map((column) => column.id));

	return tasks
		.filter(
			(task) => task.projectId === projectId && !columnIds.has(task.columnId),
		)
		.sort(compareTasksByRank)
		.map((task) => ({ task, missingColumnId: task.columnId }));
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

function getNeighborRanks(cards: Task[], input: MoveTaskInput) {
	const beforeTask = input.beforeTaskId
		? cards.find((card) => card.id === input.beforeTaskId)
		: null;
	const afterTask = input.afterTaskId
		? cards.find((card) => card.id === input.afterTaskId)
		: null;
	const fallbackBeforeTask =
		!input.beforeTaskId && !input.afterTaskId ? cards.at(-1) : null;

	return {
		beforeRank: beforeTask?.rank ?? fallbackBeforeTask?.rank ?? null,
		afterRank: afterTask?.rank ?? null,
	};
}

function isSamePosition(sourceTask: Task, cards: Task[], input: MoveTaskInput) {
	if (sourceTask.columnId !== input.toColumnId) {
		return false;
	}

	const taskIndex = cards.findIndex((card) => card.id === input.taskId);
	if (taskIndex === -1) {
		return false;
	}

	return (
		input.beforeTaskId === cards[taskIndex - 1]?.id &&
		input.afterTaskId === cards[taskIndex + 1]?.id
	);
}

export function useProjectTaskBoard(projectId: string) {
	const api = useKanaiApi();
	const tasksQuery = useQuery(api.tasks.list(projectId));
	const columnsQuery = useQuery(api.projectColumns.list(projectId));
	const moveTaskMutation = useMutation({
		mutationFn: (input: Parameters<typeof api.tasks.move>[1]) =>
			api.tasks.move(projectId, input),
	});
	const inFlightMoveRef = useRef(false);
	const [isMovePending, setIsMovePending] = useState(false);
	const [moveError, setMoveError] = useState<string | null>(null);
	const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
	const [activeDropColumnId, setActiveDropColumnId] = useState<ColumnId | null>(
		null,
	);
	const columns = groupTasksByColumn(
		tasksQuery.data ?? [],
		projectId,
		columnsQuery.data ?? [],
	);
	const invalidTasks = getTasksWithMissingColumns(
		tasksQuery.data ?? [],
		projectId,
		columnsQuery.data ?? [],
	);

	function moveTask(input: MoveTaskInput) {
		if (inFlightMoveRef.current || moveTaskMutation.isPending) {
			return;
		}

		const sourceTask = (tasksQuery.data ?? []).find(
			(task) => task.id === input.taskId,
		);
		const destinationColumn = columns.find(
			(column) => column.id === input.toColumnId,
		);
		if (!sourceTask || !destinationColumn) {
			return;
		}
		if (isSamePosition(sourceTask, destinationColumn.cards, input)) {
			return;
		}

		const cardsWithoutSource = destinationColumn.cards.filter(
			(card) => card.id !== input.taskId,
		);
		const { beforeRank, afterRank } = getNeighborRanks(
			cardsWithoutSource,
			input,
		);
		const rank = rankBetween(beforeRank, afterRank);
		if (sourceTask.columnId === input.toColumnId && sourceTask.rank === rank) {
			return;
		}

		inFlightMoveRef.current = true;
		setIsMovePending(true);
		setMoveError(null);
		const previousTasks = api.tasks.patchCached(projectId, input.taskId, {
			columnId: input.toColumnId,
			rank,
		});

		moveTaskMutation.mutate(
			{
				taskId: input.taskId,
				destination: {
					columnId: input.toColumnId,
					beforeTaskId: input.beforeTaskId,
					afterTaskId: input.afterTaskId,
				},
			},
			{
				onError: () => {
					api.tasks.replaceCached(projectId, previousTasks);
					setMoveError(moveFailureMessage);
				},
				onSettled: () => {
					inFlightMoveRef.current = false;
					setIsMovePending(false);
					void api.tasks.invalidateProjectTasks(projectId);
				},
			},
		);
	}

	return {
		columns,
		invalidTasks,
		tasksQuery,
		columnsQuery,
		dragState: {
			draggingTaskId,
			activeDropColumnId,
			setDraggingTaskId,
			setActiveDropColumnId,
		},
		moveState: {
			isMovePending,
			moveError,
		},
		moveTask,
	};
}
