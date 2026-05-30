import { Link, useNavigate } from "@tanstack/react-router";
import {
	Bell,
	Building2,
	Check,
	ChevronDown,
	ChevronRight,
	CircleHelp,
	CirclePlus,
	LayoutDashboard,
	LogOut,
	Search,
	Settings2,
	Target,
	TrendingUp,
	User,
	UserPlus,
	X,
} from "lucide-react";
import { type FormEvent, useState } from "react";

import { useCurrentUserQuery } from "#/api/client";
import { getAuthLogoutUrl } from "#/domains/auth/model/auth-client";
import { clearAuthSession } from "#/domains/auth/model/openid-client";
import { WorkspaceIconButton } from "#/domains/workspace/ui/atoms/WorkspaceIconButton";
import { SidebarNavItem } from "#/domains/workspace/ui/molecules/SidebarNavItem";
import type { SidebarItem } from "#/domains/workspace/ui/types";

const sidebarItems: SidebarItem[] = [
	{ label: "Projects", icon: LayoutDashboard, active: true, to: "/" },
	{ label: "Team Goals", icon: Target },
	{ label: "Analytics", icon: TrendingUp },
];

const sectionTabs = [
	{ label: "Projects", active: true },
	{ label: "Team" },
	{ label: "Reports" },
	{ label: "Archives" },
];

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

export function CreateProjectPage() {
	const navigate = useNavigate();
	const { data: currentUser } = useCurrentUserQuery();
	const [isMembersOpen, setIsMembersOpen] = useState(false);
	const [memberSearch, setMemberSearch] = useState("");
	const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
	const accountInitials = [
		getInitials(currentUser?.first_name),
		getInitials(currentUser?.last_name),
	]
		.join("")
		.trim();
	const normalizedMemberSearch = memberSearch.trim().toLowerCase();
	const filteredMembers = projectMembers.filter(
		(member) =>
			member.name.toLowerCase().includes(normalizedMemberSearch) ||
			member.role.toLowerCase().includes(normalizedMemberSearch),
	);
	const selectedMembers = projectMembers.filter((member) =>
		selectedMemberIds.includes(member.id),
	);

	const logoutUrl = (() => {
		if (typeof window === "undefined") {
			return null;
		}

		try {
			return getAuthLogoutUrl(window.location.origin);
		} catch {
			return null;
		}
	})();

	function handleLogout() {
		if (!logoutUrl) {
			return;
		}

		clearAuthSession();
		window.location.assign(logoutUrl);
	}

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

	return (
		<main className="min-h-screen bg-[var(--surface-container-low)] text-[var(--on-surface)]">
			<div className="flex min-h-screen flex-col lg:flex-row">
				<aside className="border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-4 lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:flex-shrink-0 lg:border-r lg:px-6 lg:py-6">
					<div className="flex h-full flex-col rounded-[1.75rem] bg-[color:color-mix(in_srgb,var(--surface-container-lowest)_78%,transparent)] p-5 shadow-[0_18px_42px_rgba(25,28,30,0.06)] backdrop-blur-xl lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none">
						<div className="flex items-center gap-3">
							<span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--primary-container)] text-[var(--on-primary)]">
								<Building2 className="h-5 w-5" />
							</span>
							<div>
								<h1 className="font-display text-xl font-bold tracking-tight text-[var(--on-surface)]">
									Executive Architect
								</h1>
								<p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
									Board Workspace
								</p>
							</div>
						</div>

						<nav className="mt-10 flex flex-col gap-1">
							{sidebarItems.map((item) => (
								<SidebarNavItem key={item.label} {...item} />
							))}
						</nav>

						<div className="mt-8 border-t border-[var(--outline-variant)] pt-6 lg:mt-auto">
							<button
								type="button"
								className="mb-4 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary-fixed)] px-4 py-3 text-sm font-semibold text-[var(--on-primary-fixed)] hover:bg-[color:color-mix(in_srgb,var(--primary-fixed)_75%,var(--primary-container))]"
							>
								<UserPlus className="h-4 w-4" />
								Invite Member
							</button>
							<nav className="flex flex-col gap-1">
								<Link
									to="/about"
									className="flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium text-[var(--on-surface-variant)] no-underline hover:bg-[var(--surface-bright)]"
								>
									<CircleHelp className="h-4 w-4" />
									Help
								</Link>
								{logoutUrl ? (
									<button
										type="button"
										onClick={handleLogout}
										className="flex items-center gap-3 rounded-full px-4 py-3 text-left text-sm font-medium text-[var(--on-surface-variant)] hover:bg-[var(--surface-bright)]"
									>
										<LogOut className="h-4 w-4" />
										Logout
									</button>
								) : (
									<Link
										to="/login"
										className="flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium text-[var(--on-surface-variant)] no-underline hover:bg-[var(--surface-bright)]"
									>
										<LogOut className="h-4 w-4" />
										Login
									</Link>
								)}
							</nav>
						</div>
					</div>
				</aside>

				<section className="min-w-0 flex-1 lg:h-screen lg:overflow-hidden">
					<header className="sticky top-0 z-20 border-b border-[var(--outline-variant)] bg-[color:color-mix(in_srgb,var(--surface-container-low)_88%,transparent)] px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
						<div className="mx-auto flex max-w-[1180px] flex-col gap-4 lg:h-16 lg:flex-row lg:items-center lg:justify-between">
							<div className="flex min-w-0 flex-1 items-center gap-5">
								<button
									type="button"
									className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--on-surface)]"
								>
									Global Strategy
									<ChevronDown className="h-4 w-4" />
								</button>
								<nav className="hidden items-center gap-5 md:flex">
									{sectionTabs.map(({ label, active }) => (
										<button
											key={label}
											type="button"
											className={[
												"border-b-2 pb-1 text-sm font-semibold",
												active
													? "border-[var(--primary)] text-[var(--primary)]"
													: "border-transparent text-[var(--on-surface-variant)] hover:text-[var(--primary)]",
											].join(" ")}
										>
											{label}
										</button>
									))}
								</nav>
							</div>

							<div className="flex items-center gap-2 self-end lg:self-auto">
								<label className="hidden items-center gap-2 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-2 text-[var(--on-surface-variant)] focus-within:border-[var(--primary)] sm:flex">
									<Search className="h-4 w-4" />
									<input
										className="w-56 border-0 bg-transparent p-0 text-sm text-[var(--on-surface)] outline-none placeholder:text-[var(--on-surface-variant)]"
										placeholder="Search..."
										type="search"
									/>
								</label>
								<WorkspaceIconButton className="text-[var(--on-surface-variant)] hover:bg-[var(--surface-bright)]">
									<Bell className="h-4 w-4" />
								</WorkspaceIconButton>
								<WorkspaceIconButton className="text-[var(--on-surface-variant)] hover:bg-[var(--surface-bright)]">
									<Settings2 className="h-4 w-4" />
								</WorkspaceIconButton>
								<span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--outline-variant)] bg-[var(--secondary-container)] text-xs font-bold text-[var(--on-secondary-container)]">
									{accountInitials || <User className="h-4 w-4" />}
								</span>
							</div>
						</div>
					</header>

					<div className="flex min-h-[calc(100vh-96px)] items-center justify-center px-4 py-8 sm:px-6 lg:h-[calc(100vh-97px)] lg:overflow-y-auto lg:px-8">
						<div className="w-full max-w-[680px]">
							<div className="mb-3 flex items-center gap-2 text-sm text-[var(--on-surface-variant)]">
								<Link
									to="/"
									className="font-medium text-[var(--on-surface-variant)] no-underline hover:text-[var(--primary)]"
								>
									Projects
								</Link>
								<ChevronRight className="h-4 w-4" />
								<span className="font-medium text-[var(--on-surface)]">
									New
								</span>
							</div>

							<section className="rise-in rounded-[1.75rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_50%,transparent)] bg-[var(--surface-container-lowest)] p-6 shadow-[0_18px_42px_rgba(25,28,30,0.04)] sm:p-10">
								<div className="mb-8">
									<h2 className="font-display text-3xl font-semibold tracking-[-0.025em] text-[var(--on-surface)] sm:text-[2.375rem]">
										Create New Project
									</h2>
									<p className="mt-2 text-base leading-7 text-[var(--on-surface-variant)]">
										Define the parameters for your next strategic initiative.
									</p>
								</div>

								<form className="flex flex-col gap-8" onSubmit={handleSubmit}>
									<div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
										<div>
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
												placeholder="e.g., Q3 Market Expansion"
												type="text"
											/>
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
															onChange={(event) =>
																setMemberSearch(event.target.value)
															}
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

													<div
														className="max-h-64 overflow-y-auto p-2"
														role="listbox"
													>
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
						</div>
					</div>
				</section>
			</div>
		</main>
	);
}
