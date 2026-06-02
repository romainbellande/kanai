import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { type Task, useKanaiApi } from "#/api/client";

const taskStatuses = ["todo", "in-progress", "done"] as const;

type TaskStatus = (typeof taskStatuses)[number];

export type TaskFormValues = {
	title: string;
	status: string;
	priority: string;
	description: string;
	acceptanceCriteria: string;
};

type UseTaskFormInput = {
	projectId: string;
	mode: "create";
	initialStatus?: string;
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
	};
}

export function useTaskForm(input: UseTaskFormInput) {
	const api = useKanaiApi();
	const [values, setValues] = useState(() =>
		createInitialValues(input.initialStatus),
	);
	const [isDirty, setIsDirty] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const createTaskMutation = useMutation({
		mutationFn: (payload: Parameters<typeof api.tasks.create>[1]) =>
			api.tasks.create(input.projectId, payload),
	});

	function setField(name: keyof TaskFormValues, value: string) {
		setValues((currentValues) => ({ ...currentValues, [name]: value }));
		setIsDirty(true);
	}

	async function submit(): Promise<Task | null> {
		setErrorMessage(null);

		const title = values.title.trim();
		const description = values.description.trim();
		const acceptanceCriteria = values.acceptanceCriteria.trim();

		if (!title) {
			setErrorMessage("Task title is required.");
			return null;
		}

		try {
			const task = await createTaskMutation.mutateAsync({
				title,
				status: values.status,
				priority: values.priority,
				description: description || undefined,
				acceptanceCriteria: acceptanceCriteria || undefined,
			});
			input.onSaved?.(task);
			return task;
		} catch {
			setErrorMessage("Task could not be created. Please try again.");
			return null;
		}
	}

	return {
		values,
		isDirty,
		isSaving: createTaskMutation.isPending,
		errorMessage,
		setField,
		submit,
	};
}
