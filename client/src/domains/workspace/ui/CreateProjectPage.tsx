import { Link, useNavigate } from "@tanstack/react-router";
import {
	Check,
	ChevronDown,
	CirclePlus,
	Search,
	UserPlus,
	X,
} from "lucide-react";
import { type FormEvent, useState } from "react";

import { WorkspaceLayout } from "#/domains/workspace/ui/templates/WorkspaceLayout";

const projectMembers = [
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

function createProjectCode(value: string): string {
	return value
		.replace(/[^a-z0-9]/gi, "")
		.slice(0, 3)
		.toUpperCase();
}

export function CreateProjectPage() {
	const navigate = useNavigate();
	const [isMembersOpen, setIsMembersOpen] = useState(false);
	const [memberSearch, setMemberSearch] = useState("");
	const [projectCode, setProjectCode] = useState("");
	const [isProjectCodeEdited, setIsProjectCodeEdited] = useState(false);
	const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
	const normalizedMemberSearch = memberSearch.trim().toLowerCase();
	const filteredMembers = projectMembers.filter(
		(member) =>
			member.name.toLowerCase().includes(normalizedMemberSearch) ||
			member.role.toLowerCase().includes(normalizedMemberSearch),
	);
	const selectedMembers = projectMembers.filter((member) =>
		selectedMemberIds.includes(member.id),
	);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		void navigate({ to: "/" });
	}

	function toggleMember(memberId: string) {
		setSelectedMemberIds((currentMemberIds) =>
			currentMemberIds.includes(memberId)
				? currentMemberIds.filter((id) => id !== memberId)
				: [...currentMemberIds, memberId],
		);
	}

	function handleProjectNameChange(value: string) {
		if (!isProjectCodeEdited) {
			setProjectCode(createProjectCode(value));
		}
	}

	function handleProjectCodeChange(value: string) {
		setIsProjectCodeEdited(true);
		setProjectCode(createProjectCode(value));
	}

	return (
		<WorkspaceLayout
			breadcrumbItems={[{ label: "Projects", to: "/" }, { label: "New" }]}
			contentContainerClassName="mx-auto flex w-full max-w-[680px] flex-col gap-8"
			contentClassName="px-4 py-8 pb-12 sm:px-6 lg:px-8"
			pageDescription="Define the parameters for your next strategic initiative."
			pageTitle="Create New Project"
			sectionClassName="lg:min-h-screen"
		>
			<section className="rise-in rounded-[1.75rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_50%,transparent)] bg-[var(--surface-container-lowest)] p-6 shadow-[0_18px_42px_rgba(25,28,30,0.04)] sm:p-10">
				<form className="flex flex-col gap-8" onSubmit={handleSubmit}>
					<div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
						<div className="sm:col-span-2">
							<label
								className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
								htmlFor="projectName"
							>
								Project Name
							</label>
							<input
								className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition placeholder:text-[var(--outline)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
								id="projectName"
								name="projectName"
								onChange={(event) =>
									handleProjectNameChange(event.target.value)
								}
								placeholder="e.g., Q3 Market Expansion"
								type="text"
							/>
						</div>

						<div>
							<label
								className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
								htmlFor="projectCode"
							>
								Project Code
							</label>
							<input
								className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--on-surface)] uppercase outline-none transition placeholder:text-[var(--outline)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
								id="projectCode"
								maxLength={3}
								minLength={3}
								name="projectCode"
								onChange={(event) =>
									handleProjectCodeChange(event.target.value)
								}
								pattern="[A-Z0-9]{3}"
								placeholder="Q3M"
								required
								title="Use exactly 3 uppercase letters or numbers."
								type="text"
								value={projectCode}
							/>
							<p className="mt-2 text-xs text-[var(--on-surface-variant)]">
								Auto-generated from the project name, but editable.
							</p>
						</div>

						<div>
							<label
								className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
								htmlFor="projectPriority"
							>
								Priority
							</label>
							<select
								className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
								defaultValue="medium"
								id="projectPriority"
								name="projectPriority"
							>
								<option value="low">Low</option>
								<option value="medium">Medium</option>
								<option value="high">High</option>
							</select>
						</div>

						<div className="sm:col-span-2">
							<label
								className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
								htmlFor="projectDescription"
							>
								Description
							</label>
							<textarea
								className="w-full resize-none rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition placeholder:text-[var(--outline)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
								id="projectDescription"
								name="projectDescription"
								placeholder="Briefly describe the goals and scope of this project..."
								rows={4}
							/>
						</div>

						<div className="relative sm:col-span-2">
							<label
								className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
								htmlFor="projectMemberSearch"
							>
								Project Members
							</label>
							<button
								aria-expanded={isMembersOpen}
								aria-haspopup="listbox"
								className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-left text-base text-[var(--on-surface)] outline-none transition hover:border-[var(--primary)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
								onClick={() => setIsMembersOpen((isOpen) => !isOpen)}
								type="button"
							>
								<span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
									<UserPlus className="h-4 w-4 flex-shrink-0 text-[var(--on-surface-variant)]" />
									{selectedMembers.length > 0 ? (
										selectedMembers.map((member) => (
											<span
												className="inline-flex max-w-full items-center gap-1 rounded-full bg-[var(--primary-fixed)] px-2.5 py-1 text-xs font-semibold text-[var(--on-primary-fixed)]"
												key={member.id}
											>
												{member.name}
											</span>
										))
									) : (
										<span className="text-[var(--outline)]">
											Add or select members...
										</span>
									)}
								</span>
								<ChevronDown
									className={`h-4 w-4 flex-shrink-0 text-[var(--on-surface-variant)] transition ${
										isMembersOpen ? "rotate-180" : ""
									}`}
								/>
							</button>
							{selectedMemberIds.map((memberId) => (
								<input
									key={memberId}
									name="projectMembers"
									type="hidden"
									value={memberId}
								/>
							))}

							{isMembersOpen ? (
								<div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] shadow-[0_18px_42px_rgba(25,28,30,0.14)]">
									<label className="m-3 flex items-center gap-2 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2 text-[var(--on-surface-variant)] focus-within:border-[var(--primary)]">
										<Search className="h-4 w-4 flex-shrink-0" />
										<input
											className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-[var(--on-surface)] outline-none placeholder:text-[var(--on-surface-variant)]"
											id="projectMemberSearch"
											onChange={(event) => setMemberSearch(event.target.value)}
											placeholder="Search members"
											type="search"
											value={memberSearch}
										/>
										{memberSearch ? (
											<button
												aria-label="Clear member search"
												className="rounded-full p-1 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
												onClick={() => setMemberSearch("")}
												type="button"
											>
												<X className="h-3.5 w-3.5" />
											</button>
										) : null}
									</label>

									<div className="max-h-64 overflow-y-auto p-2" role="listbox">
										{filteredMembers.length > 0 ? (
											filteredMembers.map((member) => {
												const isSelected = selectedMemberIds.includes(
													member.id,
												);

												return (
													<button
														aria-selected={isSelected}
														className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--surface-container-low)]"
														key={member.id}
														onClick={() => toggleMember(member.id)}
														role="option"
														type="button"
													>
														<span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--secondary-container)] text-xs font-bold text-[var(--on-secondary-container)]">
															{getInitials(member.name)}
														</span>
														<span className="min-w-0 flex-1">
															<span className="block truncate text-sm font-semibold text-[var(--on-surface)]">
																{member.name}
															</span>
															<span className="block truncate text-xs text-[var(--on-surface-variant)]">
																{member.role}
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
												No members found.
											</p>
										)}
									</div>
								</div>
							) : null}
						</div>
					</div>

					<div className="flex flex-col-reverse gap-3 border-t border-[var(--outline-variant)] pt-6 sm:flex-row sm:items-center sm:justify-end">
						<Link
							to="/"
							className="inline-flex items-center justify-center rounded-full border border-transparent px-5 py-2.5 text-sm font-semibold text-[var(--on-surface-variant)] no-underline transition hover:border-[var(--outline-variant)] hover:bg-[var(--surface-bright)]"
						>
							Cancel
						</Link>
						<button
							type="submit"
							className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--on-primary)] shadow-[0_12px_28px_rgba(0,61,155,0.18)] transition hover:bg-[var(--primary-container)]"
						>
							<CirclePlus className="h-4 w-4" />
							Create Project
						</button>
					</div>
				</form>
			</section>
		</WorkspaceLayout>
	);
}
