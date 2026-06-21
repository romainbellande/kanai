import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { type ProjectColumn, type Task, useKanaiApi } from "#/api/client";
import { Button } from "#/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "#/components/ui/field";
import { Input } from "#/components/ui/input";

export function TaskPrerequisitesField({
	columns,
	currentTaskId,
	onChange,
	projectId,
	selectedTaskIds,
	tasks = [],
}: {
	columns: readonly Pick<ProjectColumn, "id" | "name">[] | undefined;
	currentTaskId?: string;
	onChange: (taskIds: string[]) => void;
	projectId: string;
	selectedTaskIds: string[];
	tasks?: readonly Task[];
}) {
	const api = useKanaiApi();
	const [isOpen, setIsOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [knownTasks, setKnownTasks] = useState<Record<string, Task>>(() =>
		Object.fromEntries(tasks.map((task) => [task.id, task])),
	);

	useEffect(() => {
		const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
		return () => window.clearTimeout(timer);
	}, [search]);

	useEffect(() => {
		setKnownTasks((currentTasks) => ({
			...currentTasks,
			...Object.fromEntries(tasks.map((task) => [task.id, task])),
		}));
	}, [tasks]);

	const candidateQuery = useQuery({
		...api.tasks.prerequisiteCandidates(projectId, {
			title: debouncedSearch,
			limit: 10,
			excludeTaskId: currentTaskId,
		}),
		enabled: isOpen,
	});

	useEffect(() => {
		if (candidateQuery.data) {
			setKnownTasks((currentTasks) => ({
				...currentTasks,
				...Object.fromEntries(
					candidateQuery.data.map((task) => [task.id, task]),
				),
			}));
		}
	}, [candidateQuery.data]);

	const selectedTasks = selectedTaskIds.map((taskId) => knownTasks[taskId]);
	const selectedIds = useMemo(
		() => new Set(selectedTaskIds),
		[selectedTaskIds],
	);
	const options = (candidateQuery.data ?? []).filter(
		(task) => !selectedIds.has(task.id),
	);

	function columnName(task: Task | undefined) {
		return (
			columns?.find((column) => column.id === task?.columnId)?.name ??
			"Workflow"
		);
	}

	return (
		<Field className="sm:col-span-2">
			<FieldLabel htmlFor="taskPrerequisiteSearch">Depends on</FieldLabel>
			<FieldDescription>
				Choose same-project tasks that must finish before this task.
			</FieldDescription>
			<div className="flex flex-wrap gap-2">
				{selectedTaskIds.map((taskId, index) => {
					const task = selectedTasks[index];
					const title = task?.title ?? "Selected task";
					return (
						<Button
							key={taskId}
							type="button"
							variant="outline"
							onClick={() =>
								onChange(selectedTaskIds.filter((id) => id !== taskId))
							}
							aria-label={`Remove prerequisite ${title}`}
						>
							<span className="truncate">{title}</span>
							<span className="text-muted-foreground">{columnName(task)}</span>
							<X data-icon="inline-end" />
						</Button>
					);
				})}
			</div>
			<Input
				id="taskPrerequisiteSearch"
				onBlur={() => window.setTimeout(() => setIsOpen(false), 100)}
				onChange={(event) => setSearch(event.target.value)}
				onFocus={() => setIsOpen(true)}
				placeholder="Search tasks"
				type="search"
				value={search}
			/>
			{isOpen ? (
				<div className="rounded-xl border bg-background p-2 shadow-sm">
					{candidateQuery.isLoading ? (
						<p className="px-3 py-2 text-sm text-muted-foreground">
							Loading tasks…
						</p>
					) : candidateQuery.isError ? (
						<p className="px-3 py-2 text-sm text-destructive">
							Task search failed. Selected prerequisites are preserved.
						</p>
					) : options.length ? (
						options.map((task) => (
							<button
								className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
								key={task.id}
								type="button"
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => {
									onChange([...selectedTaskIds, task.id]);
									setSearch("");
								}}
							>
								<span className="truncate font-medium">{task.title}</span>
								<span className="shrink-0 text-muted-foreground">
									{columnName(task)}
								</span>
							</button>
						))
					) : (
						<p className="px-3 py-2 text-sm text-muted-foreground">
							No tasks found.
						</p>
					)}
				</div>
			) : null}
		</Field>
	);
}
