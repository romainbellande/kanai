import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { type ProjectColumn, type Task, useKanaiApi } from "#/api/client";

const NO_TASK_PRIORITY = "";

export type TaskFormValues = {
	title: string;
	status: string;
	priority: string;
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
	}

	async function submit(): Promise<Task | null> {
		setErrorMessage(null);

		const title = values.title.trim();
		const description = values.description.trim();
		const acceptanceCriteria = values.acceptanceCriteria.trim();
		const tag = values.tag.trim();
		const priority = normalizeTaskPriority(values.priority);

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
		setField,
		submit,
	};
}
