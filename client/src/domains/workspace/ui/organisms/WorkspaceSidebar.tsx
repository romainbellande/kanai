import { Link } from "@tanstack/react-router";
import { CircleHelp, LogOut, Search, UserPlus } from "lucide-react";

import { WorkspaceIconButton } from "#/domains/workspace/ui/atoms/WorkspaceIconButton";
import { SidebarNavItem } from "#/domains/workspace/ui/molecules/SidebarNavItem";
import type { SidebarItem } from "#/domains/workspace/ui/types";

type WorkspaceSidebarProps = {
	logoutUrl: string | null;
	onLogout: () => void;
	sidebarItems: SidebarItem[];
};

export function WorkspaceSidebar({
	logoutUrl,
	onLogout,
	sidebarItems,
}: WorkspaceSidebarProps) {
	return (
		<aside className="bg-[var(--surface-container-low)] px-4 py-4 sm:px-6 lg:w-72 lg:px-5 lg:py-6">
			<div className="rounded-[1.75rem] bg-[rgba(255,255,255,0.78)] p-5 shadow-[0_18px_42px_rgba(25,28,30,0.06)] backdrop-blur-xl">
				<div className="flex items-start justify-between gap-3">
					<div>
						<p className="font-display text-xl font-semibold tracking-tight text-[var(--on-surface)]">
							Executive Architect
						</p>
						<p className="mt-1 text-sm text-[var(--on-surface-variant)]">
							Board Workspace
						</p>
					</div>
					<WorkspaceIconButton
						size="sm"
						className="bg-[var(--surface-container)] text-[var(--on-surface-variant)]"
					>
						<Search className="h-4 w-4" />
					</WorkspaceIconButton>
				</div>

				<div className="mt-8">
					<p className="island-kicker mb-3">Workspace</p>
					<div className="rounded-2xl bg-[var(--surface-container)] p-4">
						<p className="text-sm font-semibold text-[var(--on-surface)]">
							Global Strategy
						</p>
						<p className="mt-1 text-sm text-[var(--on-surface-variant)]">
							Premium Tier
						</p>
					</div>
				</div>

				<nav className="mt-8 space-y-2">
					{sidebarItems.map((item) => (
						<SidebarNavItem key={item.label} {...item} />
					))}
				</nav>

				<div className="mt-8 space-y-2">
					<Link
						to="/about"
						className="flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium text-[var(--on-surface-variant)] no-underline"
					>
						<CircleHelp className="h-4 w-4" />
						<span>Help</span>
					</Link>
					{logoutUrl ? (
						<button
							type="button"
							onClick={onLogout}
							className="flex w-full items-center gap-3 rounded-full px-4 py-3 text-left text-sm font-medium text-[var(--on-surface-variant)]"
						>
							<LogOut className="h-4 w-4" />
							<span>Logout</span>
						</button>
					) : (
						<Link
							to="/login"
							className="flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium text-[var(--on-surface-variant)] no-underline"
						>
							<LogOut className="h-4 w-4" />
							<span>Login</span>
						</Link>
					)}
				</div>

				<div className="mt-8 flex flex-wrap gap-3">
					<button
						type="button"
						className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-container))] px-4 py-3 text-sm font-semibold text-[var(--on-primary)] shadow-[0_18px_36px_rgba(12,86,208,0.18)]"
					>
						<UserPlus className="h-4 w-4" />
						Invite Member
					</button>
				</div>
			</div>
		</aside>
	);
}
