import { Link } from "@tanstack/react-router";
import {
	ChevronRight,
	LayoutDashboard,
	Target,
	TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";

import { getAuthLogoutUrl } from "#/domains/auth/model/auth-client";
import { clearAuthSession } from "#/domains/auth/model/openid-client";
import { WorkspaceHeader } from "#/domains/workspace/ui/organisms/WorkspaceHeader";
import { WorkspaceSidebar } from "#/domains/workspace/ui/organisms/WorkspaceSidebar";
import type { SidebarItem } from "#/domains/workspace/ui/types";

const defaultSidebarItems: SidebarItem[] = [
	{ label: "Projects", icon: LayoutDashboard, active: true, to: "/" },
	{ label: "Team Goals", icon: Target },
	{ label: "Analytics", icon: TrendingUp },
];

type WorkspaceLayoutProps = {
	breadcrumbItems?: WorkspaceBreadcrumbItem[];
	children: ReactNode;
	contentContainerClassName?: string;
	contentClassName?: string;
	pageDescription?: ReactNode;
	pageTitle?: ReactNode;
	sectionClassName?: string;
	sidebarItems?: SidebarItem[];
};

type WorkspaceBreadcrumbItem = {
	label: string;
	to?: "/";
};

function getLogoutUrl() {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		return getAuthLogoutUrl(window.location.origin);
	} catch {
		return null;
	}
}

export function WorkspaceLayout({
	breadcrumbItems,
	children,
	contentContainerClassName = "mx-auto flex max-w-[1180px] flex-col gap-8",
	contentClassName = "px-4 py-6 pb-12 sm:px-6 lg:px-8",
	pageDescription,
	pageTitle,
	sectionClassName = "",
	sidebarItems = defaultSidebarItems,
}: WorkspaceLayoutProps) {
	const logoutUrl = getLogoutUrl();

	function handleLogout() {
		if (!logoutUrl) {
			return;
		}

		clearAuthSession();
		window.location.assign(logoutUrl);
	}

	return (
		<main className="min-h-screen bg-[var(--background)] text-[var(--on-surface)]">
			<div className="flex min-h-screen flex-col lg:flex-row">
				<WorkspaceSidebar
					logoutUrl={logoutUrl}
					onLogout={handleLogout}
					sidebarItems={sidebarItems}
				/>

				<section className={`min-w-0 flex-1 ${sectionClassName}`}>
					<WorkspaceHeader />

					<div className={contentClassName}>
						<div className={contentContainerClassName}>
							{breadcrumbItems || pageTitle || pageDescription ? (
								<div>
									{breadcrumbItems ? (
										<div className="flex items-center gap-2 text-sm text-[var(--on-surface-variant)]">
											{breadcrumbItems.map((item, index) => {
												const isLastItem = index === breadcrumbItems.length - 1;

												return (
													<div
														className="flex items-center gap-2"
														key={item.label}
													>
														{item.to && !isLastItem ? (
															<Link
																to={item.to}
																className="font-medium text-[var(--on-surface-variant)] no-underline hover:text-[var(--primary)]"
															>
																{item.label}
															</Link>
														) : (
															<span
																className={
																	isLastItem
																		? "font-medium text-[var(--on-surface)]"
																		: undefined
																}
															>
																{item.label}
															</span>
														)}
														{isLastItem ? null : (
															<ChevronRight className="h-4 w-4" />
														)}
													</div>
												);
											})}
										</div>
									) : null}
									{pageTitle ? (
										<h2 className="font-display mt-2 text-3xl font-bold tracking-tight text-[var(--on-surface)] sm:text-[2.375rem]">
											{pageTitle}
										</h2>
									) : null}
									{pageDescription ? (
										<p className="mt-2 text-base leading-7 text-[var(--on-surface-variant)]">
											{pageDescription}
										</p>
									) : null}
								</div>
							) : null}
							{children}
						</div>
					</div>
				</section>
			</div>
		</main>
	);
}
