import {
	CalendarDays,
	CheckCircle2,
	LayoutDashboard,
	Paperclip,
	Plus,
	SquareKanban,
	Target,
	TrendingUp,
	TriangleAlert,
} from "lucide-react";

import { getAuthLogoutUrl } from "#/domains/auth/model/auth-client";
import { clearAuthSession } from "#/domains/auth/model/openid-client";
import { BoardColumn } from "#/domains/workspace/ui/organisms/BoardColumn";
import { WorkspaceHeader } from "#/domains/workspace/ui/organisms/WorkspaceHeader";
import { WorkspaceSidebar } from "#/domains/workspace/ui/organisms/WorkspaceSidebar";
import type {
	BoardColumnData,
	SidebarItem,
} from "#/domains/workspace/ui/types";

const sidebarItems: SidebarItem[] = [
	{ label: "Dashboard", icon: LayoutDashboard },
	{ label: "Active Boards", icon: SquareKanban, active: true },
	{ label: "Team Goals", icon: Target },
	{ label: "Analytics", icon: TrendingUp },
];

const sectionTabs = [
	{ label: "Projects", active: true },
	{ label: "Team" },
	{ label: "Reports" },
	{ label: "Archives" },
];

const boardColumns: BoardColumnData[] = [
	{
		title: "To Do",
		count: 4,
		cards: [
			{
				tag: "Strategic",
				tagTone: "primary",
				title:
					"Conduct initial market research for Southeast Asia expansion phase",
				meta: [{ label: "Oct 12", icon: CalendarDays }],
			},
			{
				tag: "Urgent",
				tagTone: "urgent",
				title: "Update compliance documentation for GDPR 2024 standards",
				meta: [
					{ label: "Today", icon: TriangleAlert },
					{ label: "JD", compact: true },
				],
			},
		],
	},
	{
		title: "In Progress",
		count: 2,
		cards: [
			{
				tag: "Finance",
				tagTone: "neutral",
				title: "Drafting Q4 Budget Allocation Proposals",
				meta: [
					{ label: "4", icon: Paperclip },
					{ label: "Oct 18", icon: CalendarDays },
				],
			},
		],
	},
	{
		title: "Done",
		count: 12,
		cards: [
			{
				tag: null,
				tagTone: "neutral",
				title: "Security Audit Phase 1",
				meta: [{ label: "Archive Ready", icon: CheckCircle2 }],
			},
		],
	},
];

export function BoardPage() {
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

	return (
		<main className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)]">
			<div className="flex min-h-screen flex-col lg:flex-row">
				<WorkspaceSidebar
					logoutUrl={logoutUrl}
					onLogout={handleLogout}
					sidebarItems={sidebarItems}
				/>

				<section className="flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
					<div className="rounded-[2rem] bg-[var(--surface)]">
						<WorkspaceHeader
							logoutUrl={logoutUrl}
							onLogout={handleLogout}
							sectionTabs={sectionTabs}
						/>

						<div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_13rem]">
							{boardColumns.map((column, columnIndex) => (
								<BoardColumn
									key={column.title}
									column={column}
									animationDelay={`${columnIndex * 80}ms`}
								/>
							))}

							<button
								type="button"
								className="rise-in flex min-h-48 items-center justify-center gap-2 rounded-[1.5rem] bg-[rgba(255,255,255,0.62)] px-6 text-sm font-medium text-[var(--on-surface-variant)] shadow-[0_18px_36px_rgba(25,28,30,0.04)] backdrop-blur-xl"
								style={{ animationDelay: "240ms" }}
							>
								<Plus className="h-4 w-4" />
								Add another list
							</button>
						</div>
					</div>
				</section>
			</div>
		</main>
	);
}
