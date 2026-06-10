import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import {
	type Project,
	type ProjectColumn,
	type ProjectDoneColumn,
	type Task,
	useKanaiApi,
} from "#/api/client";

export const COLUMN_DESCRIPTION_MAX_LENGTH = 500;
export const RESERVED_COLUMN_NAME_MESSAGE =
	"Backlog is reserved for the project backlog and cannot be used as a workflow column name.";

export type ColumnFormValues = {
	name: string;
	description: string;
};

type ColumnFormAccessState =
	| { status: "loading"; message: string }
	| { status: "load-error"; message: string }
	| { status: "unauthorized"; message: string }
	| { status: "not-found"; message: string }
	| { status: "ready"; message: null };

type ColumnFormAccessInput = {
	column: ProjectColumn | null | undefined;
	columns: readonly ProjectColumn[] | undefined;
	currentUserId: string | undefined;
	isColumnsLoading: boolean;
	isCurrentUserLoading: boolean;
	isProjectLoading: boolean;
	project: Project | undefined;
};

type CreateColumnFormInput = {
	projectId: string;
	columns?: readonly Pick<ProjectColumn, "name">[];
	onSaved?: (column: ProjectColumn) => void;
};

type EditColumnFormInput = {
	projectId: string;
	columnId: string;
	project?: Project;
	columns?: readonly ProjectColumn[];
	doneColumn?: ProjectDoneColumn;
	tasks?: readonly Task[];
	currentUserId?: string;
	isProjectLoading?: boolean;
	isColumnsLoading?: boolean;
	isTasksLoading?: boolean;
	isCurrentUserLoading?: boolean;
	onSaved?: (column: ProjectColumn) => void;
	onDeleted?: () => void;
};

type UseColumnFormInput = CreateColumnFormInput | EditColumnFormInput;

function getDuplicateColumnName(
	name: string,
	columns: readonly Pick<ProjectColumn, "name">[] | undefined,
	excludedName?: string,
): string | null {
	const normalizedName = name.toLocaleLowerCase();
	const normalizedExcludedName = excludedName?.trim().toLocaleLowerCase();
	return (
		columns?.find(
			(column) =>
				column.name.trim().toLocaleLowerCase() === normalizedName &&
				column.name.trim().toLocaleLowerCase() !== normalizedExcludedName,
		)?.name ?? null
	);
}

export function isReservedColumnName(name: string): boolean {
	return name.trim().toLocaleLowerCase() === "backlog";
}

function isEditInput(input: UseColumnFormInput): input is EditColumnFormInput {
	return "columnId" in input;
}

export function getColumnFormAccessState({
	column,
	columns,
	currentUserId,
	isColumnsLoading,
	isCurrentUserLoading,
	isProjectLoading,
	project,
}: ColumnFormAccessInput): ColumnFormAccessState {
	if (isProjectLoading || isColumnsLoading || isCurrentUserLoading) {
		return { status: "loading", message: "Loading column details..." };
	}

	if (!project || !columns || !currentUserId) {
		return {
			status: "load-error",
			message: "Column details could not be loaded.",
		};
	}

	if (!project.ownerIds.includes(currentUserId)) {
		return {
			status: "unauthorized",
			message: "Only project owners can edit workflow columns.",
		};
	}

	if (!column) {
		return {
			status: "not-found",
			message: "This workflow column could not be found.",
		};
	}

	return { status: "ready", message: null };
}

function getAccessState(
	input: UseColumnFormInput,
	column: ProjectColumn | null | undefined,
): ColumnFormAccessState {
	if (!isEditInput(input)) {
		return { status: "ready", message: null };
	}

	return getColumnFormAccessState({
		column,
		columns: input.columns,
		currentUserId: input.currentUserId,
		isColumnsLoading: input.isColumnsLoading ?? false,
		isCurrentUserLoading: input.isCurrentUserLoading ?? false,
		isProjectLoading: input.isProjectLoading ?? false,
		project: input.project,
	});
}

function initialValues(input: UseColumnFormInput): ColumnFormValues {
	if (!isEditInput(input)) {
		return { name: "", description: "" };
	}

	const column = input.columns?.find(({ id }) => id === input.columnId);
	return {
		name: column?.name ?? "",
		description: column?.description ?? "",
	};
}

function getDeleteDisabledReason(
	input: UseColumnFormInput,
	column: ProjectColumn | null | undefined,
): string | null {
	if (!isEditInput(input)) {
		return "Only existing columns can be deleted.";
	}

	if (input.isTasksLoading || input.tasks === undefined) {
		return "Checking whether this column contains tasks...";
	}

	if ((input.columns?.length ?? 0) <= 1) {
		return "You cannot delete the final project column.";
	}

	if (column && input.doneColumn?.doneColumnId === column.id) {
		return "Designate another Done Column before deleting this column.";
	}

	if (column && input.tasks.some((task) => task.columnId === column.id)) {
		return "Move or remove this column's tasks before deleting it.";
	}

	return null;
}

export function useColumnForm(input: UseColumnFormInput) {
	const api = useKanaiApi();
	const [values, setValues] = useState<ColumnFormValues>(() =>
		initialValues(input),
	);
	const valuesRef = useRef(values);
	const [isDirty, setIsDirty] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(
		null,
	);
	const column = isEditInput(input)
		? input.columns?.find(({ id }) => id === input.columnId)
		: null;
	const accessState = getAccessState(input, column);
	const deleteDisabledReason = getDeleteDisabledReason(input, column);
	const createColumnMutation = useMutation({
		mutationFn: (payload: Parameters<typeof api.projectColumns.create>[1]) =>
			api.projectColumns.create(input.projectId, payload),
	});
	const updateColumnMutation = useMutation({
		mutationFn: (payload: Parameters<typeof api.projectColumns.update>[2]) => {
			if (!isEditInput(input)) {
				throw new Error("Column ID is required to update a column.");
			}
			return api.projectColumns.update(
				input.projectId,
				input.columnId,
				payload,
			);
		},
	});
	const deleteColumnMutation = useMutation({
		mutationFn: () => {
			if (!isEditInput(input)) {
				throw new Error("Column ID is required to delete a column.");
			}
			return api.projectColumns.delete(input.projectId, input.columnId);
		},
	});

	useEffect(() => {
		if (!isEditInput(input) || !column || isDirty) {
			return;
		}

		const description = column.description ?? "";
		if (values.name === column.name && values.description === description) {
			return;
		}

		const nextValues = { name: column.name, description };
		valuesRef.current = nextValues;
		setValues(nextValues);
	}, [column, input, isDirty, values.description, values.name]);

	function setField(name: keyof ColumnFormValues, value: string) {
		const nextValues = { ...valuesRef.current, [name]: value };
		valuesRef.current = nextValues;
		setValues(nextValues);
		setIsDirty(true);
	}

	async function submit(): Promise<ProjectColumn | null> {
		setErrorMessage(null);
		setDeleteErrorMessage(null);

		const name = valuesRef.current.name.trim();
		const description = valuesRef.current.description.trim();

		if (!name) {
			setErrorMessage("Column name is required.");
			return null;
		}

		if (isReservedColumnName(name)) {
			setErrorMessage(RESERVED_COLUMN_NAME_MESSAGE);
			return null;
		}

		if (accessState.status !== "ready") {
			setErrorMessage(accessState.message);
			return null;
		}

		const duplicateName = getDuplicateColumnName(
			name,
			input.columns,
			column?.name,
		);
		if (duplicateName) {
			setErrorMessage("A column with this name already exists.");
			return null;
		}

		if (description.length > COLUMN_DESCRIPTION_MAX_LENGTH) {
			setErrorMessage("Column description must be 500 characters or fewer.");
			return null;
		}

		try {
			if (isEditInput(input)) {
				const updatedColumn = await updateColumnMutation.mutateAsync({
					name,
					description: description || null,
				});
				const nextValues = {
					name: updatedColumn.name,
					description: updatedColumn.description ?? "",
				};
				valuesRef.current = nextValues;
				setValues(nextValues);
				setIsDirty(false);
				input.onSaved?.(updatedColumn);
				return updatedColumn;
			}

			const column = await createColumnMutation.mutateAsync({
				name,
				description: description || null,
			});
			input.onSaved?.(column);
			return column;
		} catch {
			setErrorMessage(
				isEditInput(input)
					? "Column could not be saved. Please try again."
					: "Column could not be created. Please try again.",
			);
			return null;
		}
	}

	async function deleteColumn(): Promise<boolean> {
		setErrorMessage(null);
		setDeleteErrorMessage(null);

		if (!isEditInput(input) || accessState.status !== "ready") {
			setDeleteErrorMessage(accessState.message);
			return false;
		}

		if (deleteDisabledReason) {
			setDeleteErrorMessage(deleteDisabledReason);
			return false;
		}

		if (!column) {
			setDeleteErrorMessage("This workflow column could not be found.");
			return false;
		}

		const confirmed = window.confirm(
			`Delete "${column.name}"? Unsaved edits will be discarded.`,
		);
		if (!confirmed) {
			return false;
		}

		try {
			await deleteColumnMutation.mutateAsync();
			input.onDeleted?.();
			return true;
		} catch {
			setDeleteErrorMessage("Column could not be deleted. Please try again.");
			return false;
		}
	}

	return {
		values,
		column,
		accessState,
		errorMessage,
		deleteErrorMessage,
		deleteDisabledReason,
		isSaving: isEditInput(input)
			? updateColumnMutation.isPending
			: createColumnMutation.isPending,
		isDeleting: deleteColumnMutation.isPending,
		setField,
		submit,
		deleteColumn,
	};
}
