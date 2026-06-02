import { Link } from "@tanstack/react-router";
import { CircleHelp, LogOut, Search, UserPlus } from "lucide-react";

import { WorkspaceIconButton } from "#/domains/workspace/ui/atoms/WorkspaceIconButton";
import { SidebarNavItem } from "#/domains/workspace/ui/molecules/SidebarNavItem";
import type { SidebarItem } from "#/domains/workspace/ui/types";

type WorkspaceSidebarProps = {
	onLogout: () => void;
	showLogout: boolean;
	sidebarItems: SidebarItem[];
};

export function WorkspaceSidebar({
	onLogout,
	showLogout,
	sidebarItems,
}: WorkspaceSidebarProps) {
	return (
		<aside className="border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-4 lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:flex-shrink-0 lg:border-r lg:px-6 lg:py-6">
			<div className="flex h-full flex-col rounded-[1.75rem] bg-[color:color-mix(in_srgb,var(--surface-container-lowest)_78%,transparent)] p-5 shadow-[0_18px_42px_rgba(25,28,30,0.06)] backdrop-blur-xl lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none">
				<div className="flex items-start justify-between gap-3">
					<div>
						<h1 className="font-display text-xl font-bold tracking-tight text-[var(--on-surface)]">
							Executive Architect
						</h1>
						<p className="mt-1 text-sm text-[var(--on-surface-variant)]">
							Board Workspace
						</p>
					</div>
					<WorkspaceIconButton
						size="sm"
						className="bg-[var(--surface-container-highest)] text-[var(--on-surface-variant)]"
					>
						<Search className="h-4 w-4" />
					</WorkspaceIconButton>
				</div>

				<div className="mt-8 rounded-xl bg-[var(--surface-container-high)] p-3">
					<h2 className="text-sm font-semibold text-[var(--on-surface)]">
						Global Strategy
					</h2>
					<p className="mt-1 text-xs font-semibold text-[var(--on-surface-variant)]">
						Premium Tier
					</p>
				</div>

				<nav className="mt-8 flex flex-col gap-1">
					{sidebarItems.map((item) => (
						<SidebarNavItem key={item.label} {...item} />
					))}
				</nav>

				<div className="mt-8 border-t border-[var(--outline-variant)] pt-6 lg:mt-auto">
					<nav className="mb-4 flex flex-col gap-1">
						<Link
							to="/about"
							className="flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium text-[var(--on-surface-variant)] no-underline hover:bg-[var(--surface-bright)]"
						>
							<CircleHelp className="h-4 w-4" />
							Help
						</Link>
						{showLogout ? (
							<button
								type="button"
								onClick={onLogout}
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
					<button
						type="button"
						className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--on-primary)] shadow-[0_12px_28px_rgba(0,61,155,0.18)] hover:bg-[var(--primary-container)]"
					>
						<UserPlus className="h-4 w-4" />
						Invite Member
					</button>
				</div>
			</div>
		</aside>
	);
}
