import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import {
	generateAcceptanceCriteria,
	type ProjectColumn,
	type Task,
	useKanaiApi,
} from "#/api/client";

const NO_TASK_PRIORITY = "";
const ACCEPTANCE_CRITERIA_EMPTY_CONTEXT_MESSAGE =
	"Add a task title or description before generating acceptance criteria.";
const ACCEPTANCE_CRITERIA_GENERATION_ERROR_MESSAGE =
	"Acceptance criteria could not be generated. Please try again.";
export const STORY_POINT_OPTIONS = [1, 2, 3, 5, 8, 13] as const;

export type TaskFormValues = {
	title: string;
	status: string;
	priority: string;
	storyPoints: string;
	description: string;
	acceptanceCriteria: string;
	tag: string;
};

export type TaskFormWorkflowColumn = Pick<ProjectColumn, "id" | "name">;

type TaskFormWorkflowInput = {
	columns: readonly TaskFormWorkflowColumn[] | undefined;
	defaultColumnId?: string;
	isLoading: boolean;
	requireDefaultColumn?: boolean;
	defaultColumnMissingMessage?: string;
	selectedColumnId: string;
	requireSelectedColumn?: boolean;
};

type TaskFormWorkflowState = {
	selectedColumnId: string;
	isBlocked: boolean;
	message: string | null;
};

type UseTaskFormInput =
	| {
			projectId: string;
			mode: "create";
			includeInActiveSprint?: boolean;
			createInBacklog?: boolean;
			initialColumnId?: string;
			defaultColumnId?: string;
			requireDefaultColumn?: boolean;
			defaultColumnMissingMessage?: string;
			workflowColumns?: readonly TaskFormWorkflowColumn[];
			isWorkflowLoading?: boolean;
			onSaved?: (task: Task) => void;
	  }
	| {
			projectId: string;
			mode: "edit";
			taskId: string;
			task?: Task | null;
			workflowColumns?: readonly TaskFormWorkflowColumn[];
			isWorkflowLoading?: boolean;
			onSaved?: (task: Task) => void;
	  };
export function getTaskFormWorkflowState({
	columns,
	defaultColumnId,
	isLoading,
	requireDefaultColumn,
	defaultColumnMissingMessage,
	requireSelectedColumn,
	selectedColumnId,
}: TaskFormWorkflowInput): TaskFormWorkflowState {
	if (isLoading) {
		return {
			selectedColumnId: "",
			isBlocked: true,
			message: "Loading project workflow columns...",
		};
	}

	if (!columns) {
		return {
			selectedColumnId: "",
			isBlocked: true,
			message: "Project workflow columns could not be loaded.",
		};
	}

	if (columns.length === 0) {
		return {
			selectedColumnId: "",
			isBlocked: true,
			message:
				"This project has no workflow columns. Add a workflow column before creating tasks.",
		};
	}

	const selectedColumn = columns.find(({ id }) => id === selectedColumnId);
	const defaultColumn = columns.find((column) => column.id === defaultColumnId);

	if (requireDefaultColumn && !defaultColumn) {
		return {
			selectedColumnId: defaultColumnId ?? "",
			isBlocked: true,
			message:
				defaultColumnMissingMessage ??
				"A valid workflow column is required before creating tasks.",
		};
	}

	if (!selectedColumn && selectedColumnId && requireSelectedColumn) {
		return {
			selectedColumnId,
			isBlocked: true,
			message:
				"This task references a workflow column that no longer exists. Choose a valid column after the task data is repaired.",
		};
	}

	return {
		selectedColumnId: selectedColumn?.id ?? defaultColumn?.id ?? columns[0].id,
		isBlocked: false,
		message: null,
	};
}

function createInitialValues(
	initialColumnId: string | undefined,
): TaskFormValues {
	return {
		title: "",
		status: initialColumnId ?? "",
		priority: NO_TASK_PRIORITY,
		storyPoints: "",
		description: "",
		acceptanceCriteria: "",
		tag: "",
	};
}

function editInitialValues(task: Task | null | undefined): TaskFormValues {
	return {
		title: task?.title ?? "",
		status: task?.columnId ?? "todo",
		priority: normalizeTaskPriority(task?.priority),
		storyPoints: task?.storyPoints?.toString() ?? "",
		description: task?.description ?? "",
		acceptanceCriteria: task?.acceptanceCriteria ?? "",
		tag: task?.tag ?? "",
	};
}

function normalizeTaskPriority(priority: string | null | undefined): string {
	const normalizedPriority = priority?.trim().toLowerCase() ?? NO_TASK_PRIORITY;
	if (normalizedPriority === "urgent") {
		return "critical";
	}
	return normalizedPriority;
}

function taskStoryPointsToPayload(
	storyPoints: string,
): number | null | undefined {
	if (storyPoints === "") {
		return null;
	}
	const value = Number(storyPoints);
	return STORY_POINT_OPTIONS.includes(
		value as (typeof STORY_POINT_OPTIONS)[number],
	)
		? value
		: undefined;
}

function blankToNull(value: string): string | null {
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

function initialValues(input: UseTaskFormInput): TaskFormValues {
	return input.mode === "create"
		? createInitialValues(input.initialColumnId)
		: editInitialValues(input.task);
}

export function useTaskForm(input: UseTaskFormInput) {
	const api = useKanaiApi();
	const editTask = input.mode === "edit" ? input.task : null;
	const [values, setValues] = useState(() => initialValues(input));
	const [isDirty, setIsDirty] = useState(false);
	const [formTaskId, setFormTaskId] = useState(() =>
		input.mode === "edit" ? (input.task?.id ?? null) : null,
	);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [
		acceptanceCriteriaGenerationMessage,
		setAcceptanceCriteriaGenerationMessage,
	] = useState<string | null>(null);
	const [isGeneratingAcceptanceCriteria, setIsGeneratingAcceptanceCriteria] =
		useState(false);
	const acceptanceCriteriaAbortControllerRef = useRef<AbortController | null>(
		null,
	);
	const workflowState =
		input.mode === "create"
			? getTaskFormWorkflowState({
					columns: input.workflowColumns,
					defaultColumnId: input.defaultColumnId,
					isLoading: input.isWorkflowLoading ?? false,
					requireDefaultColumn: input.requireDefaultColumn,
					defaultColumnMissingMessage: input.defaultColumnMissingMessage,
					selectedColumnId: values.status,
				})
			: getTaskFormWorkflowState({
					columns: input.workflowColumns,
					isLoading: input.isWorkflowLoading ?? false,
					selectedColumnId: values.status,
					requireSelectedColumn: true,
				});
	const createTaskMutation = useMutation({
		mutationFn: (payload: Parameters<typeof api.tasks.create>[1]) =>
			input.mode === "create" && input.createInBacklog
				? api.backlog.createTask(input.projectId, payload)
				: api.tasks.create(input.projectId, payload),
	});
	const updateTaskMutation = useMutation({
		mutationFn: (payload: Parameters<typeof api.tasks.update>[1]) =>
			api.tasks.update(input.projectId, payload),
	});

	useEffect(() => {
		if (input.mode !== "create") {
			return;
		}

		if (
			workflowState.selectedColumnId &&
			values.status !== workflowState.selectedColumnId
		) {
			setValues((currentValues) => ({
				...currentValues,
				status: workflowState.selectedColumnId,
			}));
		}
	}, [input.mode, values.status, workflowState.selectedColumnId]);

	useEffect(() => {
		if (input.mode !== "edit" || !editTask) {
			return;
		}

		if (formTaskId !== editTask.id || !isDirty) {
			setValues(editInitialValues(editTask));
			setFormTaskId(editTask.id);
			setIsDirty(false);
		}
	}, [editTask, formTaskId, input.mode, isDirty]);

	function setField(name: keyof TaskFormValues, value: string) {
		setValues((currentValues) => ({ ...currentValues, [name]: value }));
		setIsDirty(true);
		if (name === "title" || name === "description") {
			setAcceptanceCriteriaGenerationMessage(null);
		}
	}

	async function generateAcceptanceCriteriaForForm(): Promise<void> {
		if (acceptanceCriteriaAbortControllerRef.current) {
			return;
		}

		const title = values.title.trim();
		const description = values.description.trim();

		if (!title && !description) {
			setAcceptanceCriteriaGenerationMessage(
				ACCEPTANCE_CRITERIA_EMPTY_CONTEXT_MESSAGE,
			);
			return;
		}

		const previousAcceptanceCriteria = values.acceptanceCriteria;
		const selectedWorkflowColumn = input.workflowColumns?.find(
			(column) => column.id === workflowState.selectedColumnId,
		);
		const abortController = new AbortController();

		setAcceptanceCriteriaGenerationMessage(null);
		acceptanceCriteriaAbortControllerRef.current = abortController;
		setIsGeneratingAcceptanceCriteria(true);
		setIsDirty(true);
		setValues((currentValues) => ({
			...currentValues,
			acceptanceCriteria: "",
		}));

		try {
			await generateAcceptanceCriteria({
				projectId: input.projectId,
				signal: abortController.signal,
				task: {
					title: blankToNull(values.title),
					description: blankToNull(values.description),
					acceptanceCriteria: blankToNull(previousAcceptanceCriteria),
					priority: blankToNull(normalizeTaskPriority(values.priority)),
					storyPoints: taskStoryPointsToPayload(values.storyPoints) ?? null,
					tag: blankToNull(values.tag),
					workflowColumn: selectedWorkflowColumn?.name ?? null,
					mode: input.mode,
				},
				onChunk: (chunk) => {
					setValues((currentValues) => ({
						...currentValues,
						acceptanceCriteria: currentValues.acceptanceCriteria + chunk,
					}));
				},
			});
		} catch {
			if (abortController.signal.aborted) {
				return;
			}

			setValues((currentValues) => ({
				...currentValues,
				acceptanceCriteria: previousAcceptanceCriteria,
			}));
			setAcceptanceCriteriaGenerationMessage(
				ACCEPTANCE_CRITERIA_GENERATION_ERROR_MESSAGE,
			);
		} finally {
			if (acceptanceCriteriaAbortControllerRef.current === abortController) {
				acceptanceCriteriaAbortControllerRef.current = null;
			}
			setIsGeneratingAcceptanceCriteria(false);
		}
	}

	function cancelAcceptanceCriteriaGeneration(): void {
		acceptanceCriteriaAbortControllerRef.current?.abort();
	}

	async function submit(): Promise<Task | null> {
		setErrorMessage(null);

		const title = values.title.trim();
		const description = values.description.trim();
		const acceptanceCriteria = values.acceptanceCriteria.trim();
		const tag = values.tag.trim();
		const priority = normalizeTaskPriority(values.priority);
		const storyPoints = taskStoryPointsToPayload(values.storyPoints);

		if (!title) {
			setErrorMessage("Task title is required.");
			return null;
		}

		if (workflowState.isBlocked) {
			setErrorMessage(workflowState.message);
			return null;
		}

		try {
			if (input.mode === "edit") {
				const task = await updateTaskMutation.mutateAsync({
					taskId: input.taskId,
					values: {
						title,
						columnId: values.status,
						priority: priority || null,
						storyPoints: storyPoints ?? null,
						description: description || null,
						acceptanceCriteria: acceptanceCriteria || null,
						tag: tag || null,
					},
				});
				api.tasks.patchCached(input.projectId, input.taskId, task);
				setValues(editInitialValues(task));
				setFormTaskId(task.id);
				setIsDirty(false);
				input.onSaved?.(task);
				return task;
			}

			const task = await createTaskMutation.mutateAsync({
				title,
				columnId: workflowState.selectedColumnId,
				...(!input.createInBacklog && input.includeInActiveSprint
					? { includeInActiveSprint: true }
					: {}),
				priority: priority || undefined,
				storyPoints: storyPoints ?? undefined,
				description: description || undefined,
				acceptanceCriteria: acceptanceCriteria || undefined,
				tag: tag || undefined,
			});
			input.onSaved?.(task);
			return task;
		} catch {
			setErrorMessage(
				input.mode === "create"
					? "Task could not be created. Please try again."
					: "Task could not be saved. Please try again.",
			);
			return null;
		}
	}

	return {
		values,
		isDirty,
		isSaving:
			input.mode === "create"
				? createTaskMutation.isPending
				: updateTaskMutation.isPending,
		errorMessage,
		workflowState,
		acceptanceCriteriaGeneration: {
			canGenerate: Boolean(values.title.trim() || values.description.trim()),
			isGenerating: isGeneratingAcceptanceCriteria,
			message:
				acceptanceCriteriaGenerationMessage ??
				(values.title.trim() || values.description.trim()
					? null
					: ACCEPTANCE_CRITERIA_EMPTY_CONTEXT_MESSAGE),
			generate: generateAcceptanceCriteriaForForm,
			cancel: cancelAcceptanceCriteriaGeneration,
		},
		setField,
		submit,
	};
}
