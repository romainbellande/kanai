import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Check, ChevronDown, CirclePlus, Search, User, X } from "lucide-react";
import { type FormEvent, useState } from "react";

import { WorkspaceLayout } from "#/domains/workspace/ui/templates/WorkspaceLayout";

const projectNames: Record<string, string> = {
	"enterprise-launch": "Enterprise Launch",
	"q4-logistics-scaling": "Q4 Logistics Scaling",
	"security-audit-phase-1": "Security Audit Phase 1",
};

const taskAssignees = [
	{ id: "maya-chen", name: "Maya Chen", role: "Product Lead" },
	{ id: "omar-hassan", name: "Omar Hassan", role: "Engineering" },
	{ id: "ava-patel", name: "Ava Patel", role: "Design" },
	{ id: "lucas-meyer", name: "Lucas Meyer", role: "Operations" },
	{ id: "sophia-kim", name: "Sophia Kim", role: "Strategy" },
];

function getInitials(value: string | null | undefined): string {
	const normalizedValue = value?.trim();

	return normalizedValue ? normalizedValue.slice(0, 1).toUpperCase() : "";
}

export function CreateTaskPage() {
	const { projectId } = useParams({ from: "/projects_/$projectId/tasks/new" });
	const navigate = useNavigate();
	const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
	const [assigneeSearch, setAssigneeSearch] = useState("");
	const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
	const projectName = projectNames[projectId] ?? "Project";
	const normalizedAssigneeSearch = assigneeSearch.trim().toLowerCase();
	const filteredAssignees = taskAssignees.filter(
		(assignee) =>
			assignee.name.toLowerCase().includes(normalizedAssigneeSearch) ||
			assignee.role.toLowerCase().includes(normalizedAssigneeSearch),
	);
	const selectedAssignee = taskAssignees.find(
		(assignee) => assignee.id === selectedAssigneeId,
	);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		void navigate({ to: "/projects/$projectId", params: { projectId } });
	}

	return (
		<WorkspaceLayout
			breadcrumbItems={[
				{ label: "Projects", to: "/" },
				{
					label: projectName,
					to: "/projects/$projectId",
					params: { projectId },
				},
				{ label: "New Task" },
			]}
			contentContainerClassName="mx-auto flex w-full max-w-[760px] flex-col gap-8"
			contentClassName="px-4 py-8 pb-12 sm:px-6 lg:px-8"
			pageDescription="Capture the work item and assign the details needed to move it forward."
			pageTitle="Create New Task"
			sectionClassName="lg:min-h-screen"
		>
			<section className="rise-in rounded-[1.75rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_50%,transparent)] bg-[var(--surface-container-lowest)] p-6 shadow-[0_18px_42px_rgba(25,28,30,0.04)] sm:p-10">
				<form className="flex flex-col gap-8" onSubmit={handleSubmit}>
					<div className="flex flex-col gap-8">
						<section className="grid grid-cols-1 gap-5 sm:grid-cols-2">
							<div className="sm:col-span-2">
								<h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--primary)]">
									Task Details
								</h2>
								<p className="mt-1 text-sm text-[var(--on-surface-variant)]">
									Name the work item before assigning ownership and priority.
								</p>
							</div>

							<div className="sm:col-span-2">
								<label
									className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
									htmlFor="taskTitle"
								>
									Task Title
								</label>
								<input
									className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition placeholder:text-[var(--outline)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
									id="taskTitle"
									name="taskTitle"
									placeholder="e.g., Finalize launch readiness checklist"
									required
									type="text"
								/>
							</div>
						</section>

						<section className="grid grid-cols-1 gap-5 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4 sm:grid-cols-2 sm:p-5">
							<div className="sm:col-span-2">
								<h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--primary)]">
									Planning
								</h2>
								<p className="mt-1 text-sm text-[var(--on-surface-variant)]">
									Set the workflow state, urgency, and assignee in one pass.
								</p>
							</div>

							<div>
								<label
									className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
									htmlFor="taskStatus"
								>
									Status
								</label>
								<select
									className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
									defaultValue="todo"
									id="taskStatus"
									name="taskStatus"
								>
									<option value="todo">To Do</option>
									<option value="in-progress">In Progress</option>
									<option value="done">Done</option>
								</select>
							</div>

							<div>
								<label
									className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
									htmlFor="taskPriority"
								>
									Priority
								</label>
								<select
									className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
									defaultValue="medium"
									id="taskPriority"
									name="taskPriority"
								>
									<option value="low">Low</option>
									<option value="medium">Medium</option>
									<option value="high">High</option>
									<option value="urgent">Urgent</option>
								</select>
							</div>

							<div className="relative sm:col-span-2">
								<label
									className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
									htmlFor="taskAssigneeSearch"
								>
									Assignee
								</label>
								<button
									aria-expanded={isAssigneeOpen}
									aria-haspopup="listbox"
									className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-left text-base text-[var(--on-surface)] outline-none transition hover:border-[var(--primary)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
									onClick={() => setIsAssigneeOpen((isOpen) => !isOpen)}
									type="button"
								>
									<span className="flex min-w-0 flex-1 items-center gap-2">
										<User className="h-4 w-4 flex-shrink-0 text-[var(--on-surface-variant)]" />
										{selectedAssignee ? (
											<span className="truncate font-medium">
												{selectedAssignee.name}
											</span>
										) : (
											<span className="text-[var(--outline)]">
												Select an assignee...
											</span>
										)}
									</span>
									<ChevronDown
										className={`h-4 w-4 flex-shrink-0 text-[var(--on-surface-variant)] transition ${
											isAssigneeOpen ? "rotate-180" : ""
										}`}
									/>
								</button>
								<input
									name="taskAssignee"
									type="hidden"
									value={selectedAssigneeId}
								/>

								{isAssigneeOpen ? (
									<div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] shadow-[0_18px_42px_rgba(25,28,30,0.14)]">
										<label className="m-3 flex items-center gap-2 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2 text-[var(--on-surface-variant)] focus-within:border-[var(--primary)]">
											<Search className="h-4 w-4 flex-shrink-0" />
											<input
												className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-[var(--on-surface)] outline-none placeholder:text-[var(--on-surface-variant)]"
												id="taskAssigneeSearch"
												onChange={(event) =>
													setAssigneeSearch(event.target.value)
												}
												placeholder="Search assignees"
												type="search"
												value={assigneeSearch}
											/>
											{assigneeSearch ? (
												<button
													aria-label="Clear assignee search"
													className="rounded-full p-1 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
													onClick={() => setAssigneeSearch("")}
													type="button"
												>
													<X className="h-3.5 w-3.5" />
												</button>
											) : null}
										</label>

										<div
											className="max-h-64 overflow-y-auto p-2"
											role="listbox"
										>
											{filteredAssignees.length > 0 ? (
												filteredAssignees.map((assignee) => {
													const isSelected = assignee.id === selectedAssigneeId;

													return (
														<button
															aria-selected={isSelected}
															className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--surface-container-low)]"
															key={assignee.id}
															onClick={() => {
																setSelectedAssigneeId(assignee.id);
																setIsAssigneeOpen(false);
															}}
															role="option"
															type="button"
														>
															<span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--secondary-container)] text-xs font-bold text-[var(--on-secondary-container)]">
																{getInitials(assignee.name)}
															</span>
															<span className="min-w-0 flex-1">
																<span className="block truncate text-sm font-semibold text-[var(--on-surface)]">
																	{assignee.name}
																</span>
																<span className="block truncate text-xs text-[var(--on-surface-variant)]">
																	{assignee.role}
																</span>
															</span>
															<span
																className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border ${
																	isSelected
																		? "border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]"
																		: "border-[var(--outline-variant)] text-transparent"
																}`}
															>
																<Check className="h-3.5 w-3.5" />
															</span>
														</button>
													);
												})
											) : (
												<p className="px-3 py-4 text-sm text-[var(--on-surface-variant)]">
													No assignees found.
												</p>
											)}
										</div>
									</div>
								) : null}
							</div>
						</section>

						<section className="grid grid-cols-1 gap-5">
							<div>
								<h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--primary)]">
									Work Notes
								</h2>
								<p className="mt-1 text-sm text-[var(--on-surface-variant)]">
									Separate background context from the conditions required to
									finish.
								</p>
							</div>

							<div>
								<label
									className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
									htmlFor="taskDescription"
								>
									Description
								</label>
								<textarea
									className="w-full resize-none rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition placeholder:text-[var(--outline)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
									id="taskDescription"
									name="taskDescription"
									placeholder="Add context, background, or handoff notes..."
									rows={5}
								/>
							</div>

							<div>
								<label
									className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
									htmlFor="taskAcceptanceCriteria"
								>
									Acceptance Criteria
								</label>
								<textarea
									className="w-full resize-none rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition placeholder:text-[var(--outline)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
									id="taskAcceptanceCriteria"
									name="taskAcceptanceCriteria"
									placeholder="List the conditions that must be met for this task to be complete..."
									rows={4}
								/>
							</div>
						</section>
					</div>

					<div className="flex flex-col-reverse gap-3 border-t border-[var(--outline-variant)] pt-6 sm:flex-row sm:items-center sm:justify-end">
						<Link
							to="/projects/$projectId"
							params={{ projectId }}
							className="inline-flex items-center justify-center rounded-full border border-transparent px-5 py-2.5 text-sm font-semibold text-[var(--on-surface-variant)] no-underline transition hover:border-[var(--outline-variant)] hover:bg-[var(--surface-bright)]"
						>
							Cancel
						</Link>
						<button
							type="submit"
							className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--on-primary)] shadow-[0_12px_28px_rgba(0,61,155,0.18)] transition hover:bg-[var(--primary-container)]"
						>
							<CirclePlus className="h-4 w-4" />
							Create Task
						</button>
					</div>
				</form>
			</section>
		</WorkspaceLayout>
	);
}
