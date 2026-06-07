import { Bell, Search, Settings2, User } from "lucide-react";

import { getCurrentUserInitials, useCurrentUserQuery } from "#/api/client";
import { WorkspaceIconButton } from "#/domains/workspace/ui/atoms/WorkspaceIconButton";

export function WorkspaceHeader() {
	const { data: currentUser } = useCurrentUserQuery();

	const accountInitials = getCurrentUserInitials(currentUser);

	return (
		<header className="sticky top-0 z-20 grid gap-4 border-[var(--outline-variant)] bg-[color:color-mix(in_srgb,var(--background)_88%,transparent)] px-4 py-4 backdrop-blur-xl sm:px-6 lg:grid-cols-[1fr_minmax(0,42rem)_1fr] lg:items-center lg:border-b lg:px-8">
			<label className="flex min-w-0 items-center gap-2 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-2 text-[var(--on-surface-variant)] focus-within:border-[var(--primary)] lg:col-start-2">
				<Search className="h-4 w-4 flex-shrink-0" />
				<input
					className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-[var(--on-surface)] outline-none placeholder:text-[var(--on-surface-variant)]"
					placeholder="Search projects, cards, and teammates"
					type="search"
				/>
			</label>

			<div className="flex items-center gap-2 justify-self-end lg:col-start-3 lg:row-start-1">
				<WorkspaceIconButton className="text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]">
					<Bell className="h-4 w-4" />
				</WorkspaceIconButton>
				<WorkspaceIconButton className="text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]">
					<Settings2 className="h-4 w-4" />
				</WorkspaceIconButton>
				<button
					type="button"
					className="flex items-center gap-2 rounded-full border-l border-[var(--outline-variant)] py-1 pl-3 pr-4 text-sm font-semibold text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
				>
					<span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-container)] text-xs font-bold text-[var(--on-primary)]">
						{accountInitials || <User className="h-4 w-4" />}
					</span>
					Account
				</button>
			</div>
		</header>
	);
}
