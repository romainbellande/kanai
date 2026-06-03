import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { type Task, useKanaiApi } from "#/api/client";

const taskStatuses = ["todo", "in-progress", "done"] as const;

type TaskStatus = (typeof taskStatuses)[number];

export type TaskFormValues = {
	title: string;
	status: string;
	priority: string;
	description: string;
	acceptanceCriteria: string;
	tag: string;
};

type UseTaskFormInput =
	| {
			projectId: string;
			mode: "create";
			initialStatus?: string;
			onSaved?: (task: Task) => void;
	  }
	| {
			projectId: string;
			mode: "edit";
			taskId: string;
			task?: Task | null;
			onSaved?: (task: Task) => void;
	  };

function getInitialTaskStatus(status: string | undefined): TaskStatus {
	return taskStatuses.find((taskStatus) => taskStatus === status) ?? "todo";
}

function createInitialValues(
	initialStatus: string | undefined,
): TaskFormValues {
	return {
		title: "",
		status: getInitialTaskStatus(initialStatus),
		priority: "medium",
		description: "",
		acceptanceCriteria: "",
		tag: "",
	};
}

function editInitialValues(task: Task | null | undefined): TaskFormValues {
	return {
		title: task?.title ?? "",
		status: task?.columnId ?? "todo",
		priority: task?.priority ?? "medium",
		description: task?.description ?? "",
		acceptanceCriteria: task?.acceptanceCriteria ?? "",
		tag: task?.tag ?? "",
	};
}

function initialValues(input: UseTaskFormInput): TaskFormValues {
	return input.mode === "create"
		? createInitialValues(input.initialStatus)
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
	const createTaskMutation = useMutation({
		mutationFn: (payload: Parameters<typeof api.tasks.create>[1]) =>
			api.tasks.create(input.projectId, payload),
	});
	const updateTaskMutation = useMutation({
		mutationFn: (payload: Parameters<typeof api.tasks.update>[1]) =>
			api.tasks.update(input.projectId, payload),
	});

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

		if (!title) {
			setErrorMessage("Task title is required.");
			return null;
		}

		try {
			if (input.mode === "edit") {
				const task = await updateTaskMutation.mutateAsync({
					taskId: input.taskId,
					values: {
						title,
						columnId: values.status,
						priority: values.priority,
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
				columnId: values.status,
				priority: values.priority,
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
		setField,
		submit,
	};
}
