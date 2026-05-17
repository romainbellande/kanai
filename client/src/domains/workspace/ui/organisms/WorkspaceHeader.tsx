import { Link } from "@tanstack/react-router";
import {
	Bell,
	ChevronDown,
	ChevronRight,
	Filter,
	LogOut,
	PanelLeft,
	PanelRight,
	Search,
	Settings2,
	Share2,
	User,
} from "lucide-react";

import { useCurrentUserQuery } from "#/api/client";
import { WorkspaceIconButton } from "#/domains/workspace/ui/atoms/WorkspaceIconButton";

type SectionTab = {
	label: string;
	active?: boolean;
};

type WorkspaceHeaderProps = {
	logoutUrl: string | null;
	onLogout: () => void;
	sectionTabs: SectionTab[];
};

function getInitials(value: string | null | undefined): string {
	const normalizedValue = value?.trim();

	return normalizedValue ? normalizedValue.slice(0, 1).toUpperCase() : "";
}

export function WorkspaceHeader({
	logoutUrl,
	onLogout,
	sectionTabs,
}: WorkspaceHeaderProps) {
	const { data: currentUser } = useCurrentUserQuery();

	const accountInitials = [
		getInitials(currentUser?.first_name),
		getInitials(currentUser?.last_name),
	]
		.join("")
		.trim();

	return (
		<>
			<div className="sticky top-0 z-20 rounded-[1.75rem] bg-[rgba(255,255,255,0.78)] px-5 py-4 shadow-[0_18px_42px_rgba(25,28,30,0.04)] backdrop-blur-xl">
				<div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
					<div className="min-w-0 flex-1">
						<div className="inline-flex items-center gap-1.5 text-sm text-[var(--on-surface-variant)]">
							<span>Global Strategy</span>
							<ChevronDown className="h-4 w-4" />
						</div>
						<div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
							{sectionTabs.map(({ label, active }) => (
								<button
									key={label}
									type="button"
									className={[
										"text-sm font-medium transition",
										active
											? "text-[var(--on-surface)]"
											: "text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]",
									].join(" ")}
								>
									{label}
								</button>
							))}
						</div>
					</div>
					<div className="flex items-start gap-2 self-end xl:self-auto">
						<WorkspaceIconButton className="bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)] shadow-[0_12px_24px_rgba(25,28,30,0.05)]">
							<Bell className="h-4 w-4" />
						</WorkspaceIconButton>
						<WorkspaceIconButton className="bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)] shadow-[0_12px_24px_rgba(25,28,30,0.05)]">
							<Settings2 className="h-4 w-4" />
						</WorkspaceIconButton>
						<div className="relative hidden sm:block">
							<button
								type="button"
								className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--surface-container-lowest)] px-2 text-sm font-medium text-[var(--on-surface)] shadow-[0_12px_24px_rgba(25,28,30,0.05)]"
							>
								<span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-container)] text-xs font-semibold tracking-[0.08em] text-[var(--on-surface)]">
									{accountInitials ? (
										accountInitials
									) : (
										<User className="h-4 w-4 text-[var(--on-surface-variant)]" />
									)}
								</span>
								Account
							</button>
							<div className="absolute right-0 top-[calc(100%+0.5rem)] w-52 rounded-[1.15rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_16%,transparent)] bg-[rgba(255,255,255,0.84)] p-2 text-sm shadow-[0_20px_44px_rgba(25,28,30,0.08)] backdrop-blur-[20px]">
								<Link
									to="/about"
									className="flex items-center gap-2.5 rounded-[0.9rem] px-3 py-2.5 text-[var(--on-surface)] no-underline hover:bg-[var(--surface-container-low)]"
								>
									<User className="h-4 w-4 text-[var(--on-surface-variant)]" />
									<span>Profile</span>
								</Link>
								{logoutUrl ? (
									<button
										type="button"
										onClick={onLogout}
										className="flex w-full items-center gap-2.5 rounded-[0.9rem] px-3 py-2.5 text-left text-[var(--on-surface)] hover:bg-[color:color-mix(in_srgb,var(--tertiary-container)_8%,white)]"
									>
										<LogOut className="h-4 w-4 text-[var(--on-surface-variant)]" />
										<span>Logout</span>
									</button>
								) : (
									<Link
										to="/login"
										className="flex items-center gap-2.5 rounded-[0.9rem] px-3 py-2.5 text-[var(--on-surface)] no-underline hover:bg-[var(--surface-container-low)]"
									>
										<LogOut className="h-4 w-4 text-[var(--on-surface-variant)]" />
										<span>Login</span>
									</Link>
								)}
							</div>
						</div>
						<div className="sm:hidden">
							{logoutUrl ? (
								<button
									type="button"
									onClick={onLogout}
									className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--surface-container-lowest)] px-4 text-sm font-medium text-[var(--on-surface)] shadow-[0_12px_24px_rgba(25,28,30,0.05)]"
								>
									<LogOut className="h-4 w-4" />
									Logout
								</button>
							) : (
								<Link
									to="/login"
									className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--surface-container-lowest)] px-4 text-sm font-medium text-[var(--on-surface)] no-underline shadow-[0_12px_24px_rgba(25,28,30,0.05)]"
								>
									<LogOut className="h-4 w-4" />
									Login
								</Link>
							)}
						</div>
					</div>
				</div>

				<div className="mt-4 flex min-w-0 items-center gap-3 rounded-full bg-[color:color-mix(in_srgb,var(--primary-fixed)_55%,white)] px-4 py-3 text-[var(--on-primary-fixed)]">
					<Search className="h-4 w-4 flex-shrink-0" />
					<span className="truncate text-sm">
						Search projects, cards, and teammates
					</span>
				</div>
			</div>

			<div className="mt-6 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
				<div>
					<div className="flex flex-wrap items-center gap-2 text-sm text-[var(--on-surface-variant)]">
						<span>Projects</span>
						<ChevronRight className="h-4 w-4" />
						<span>Enterprise Launch</span>
					</div>
					<h1 className="font-display mt-3 text-3xl font-semibold tracking-tight text-[var(--on-surface)] sm:text-[2.4rem]">
						Main Board: Q4 Logistics
					</h1>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<div className="flex items-center gap-2 rounded-full bg-[var(--surface-container)] p-1">
						<WorkspaceIconButton
							size="sm"
							className="bg-[var(--surface-container-lowest)] text-[var(--on-surface)] shadow-[0_8px_18px_rgba(25,28,30,0.05)]"
						>
							<PanelLeft className="h-4 w-4" />
						</WorkspaceIconButton>
						<WorkspaceIconButton
							size="sm"
							className="text-[var(--on-surface-variant)]"
						>
							<PanelRight className="h-4 w-4" />
						</WorkspaceIconButton>
					</div>
					<div className="flex items-center -space-x-2">
						{["AM", "RS", "+4"].map((member) => (
							<div
								key={member}
								className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-container-lowest)] text-xs font-semibold text-[var(--on-surface)] shadow-[0_10px_22px_rgba(25,28,30,0.05)]"
							>
								{member}
							</div>
						))}
					</div>
					<button
						type="button"
						className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-container)] px-4 py-3 text-sm font-medium text-[var(--on-surface-variant)]"
					>
						<Filter className="h-4 w-4" />
						Filter
					</button>
					<button
						type="button"
						className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-container)] px-4 py-3 text-sm font-medium text-[var(--on-surface-variant)]"
					>
						<Share2 className="h-4 w-4" />
						Share
					</button>
				</div>
			</div>
		</>
	);
}
