import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Bell,
	CalendarDays,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	CircleHelp,
	Filter,
	LayoutDashboard,
	LogOut,
	MoreHorizontal,
	PanelLeft,
	PanelRight,
	Paperclip,
	Plus,
	Search,
	Settings2,
	Share2,
	SquareKanban,
	Target,
	TrendingUp,
	TriangleAlert,
	User,
	UserPlus,
} from "lucide-react";

import { getAuthLogoutUrl } from "#/lib/auth-client";
import { clearAuthSession } from "#/lib/openid-client";

export const Route = createFileRoute("/")({ component: App });

const sidebarItems = [
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

const boardColumns = [
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

function App() {
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
							<button
								type="button"
								className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-container)] text-[var(--on-surface-variant)]"
							>
								<Search className="h-4 w-4" />
							</button>
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
							{sidebarItems.map(({ label, icon: Icon, active }) => (
								<div
									key={label}
									className={[
										"flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium",
										active
											? "bg-[var(--primary-fixed)] text-[var(--on-primary-fixed)]"
											: "text-[var(--on-surface-variant)]",
									].join(" ")}
								>
									<Icon className="h-4 w-4" />
									<span>{label}</span>
								</div>
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
									onClick={handleLogout}
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

				<section className="flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
					<div className="rounded-[2rem] bg-[var(--surface)]">
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
									<button
										type="button"
										className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)] shadow-[0_12px_24px_rgba(25,28,30,0.05)]"
									>
										<Bell className="h-4 w-4" />
									</button>
									<button
										type="button"
										className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)] shadow-[0_12px_24px_rgba(25,28,30,0.05)]"
									>
										<Settings2 className="h-4 w-4" />
									</button>
									<div className="relative hidden sm:block">
										<button
											type="button"
											className="inline-flex h-11 items-center rounded-full px-2 text-sm font-medium text-[var(--on-surface)]"
										>
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
													onClick={handleLogout}
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
												onClick={handleLogout}
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
									<button
										type="button"
										className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-container-lowest)] text-[var(--on-surface)] shadow-[0_8px_18px_rgba(25,28,30,0.05)]"
									>
										<PanelLeft className="h-4 w-4" />
									</button>
									<button
										type="button"
										className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--on-surface-variant)]"
									>
										<PanelRight className="h-4 w-4" />
									</button>
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

						<div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_13rem]">
							{boardColumns.map((column, columnIndex) => (
								<section
									key={column.title}
									className="rise-in rounded-[1.5rem] bg-[var(--surface-container)] p-4 shadow-[0_18px_36px_rgba(25,28,30,0.04)]"
									style={{ animationDelay: `${columnIndex * 80}ms` }}
								>
									<div className="flex items-center justify-between gap-3">
										<div>
											<h2 className="text-sm font-semibold text-[var(--on-surface-variant)]">
												{column.title}
											</h2>
											<p className="mt-1 text-xs text-[var(--outline)]">
												{column.count}
											</p>
										</div>
										<button
											type="button"
											className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)]"
										>
											<MoreHorizontal className="h-4 w-4" />
										</button>
									</div>

									<div className="mt-4 space-y-4">
										{column.cards.map((card) => (
											<article
												key={card.title}
												className="rounded-[1rem] bg-[var(--surface-container-lowest)] p-4 shadow-[0_18px_34px_rgba(25,28,30,0.04)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-bright)] hover:shadow-[0_24px_40px_rgba(25,28,30,0.08)]"
											>
												{card.tag ? (
													<span
														className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
														style={{
															backgroundColor:
																card.tagTone === "urgent"
																	? "color-mix(in srgb, var(--tertiary-container) 12%, white)"
																	: card.tagTone === "primary"
																		? "color-mix(in srgb, var(--primary-fixed) 75%, white)"
																		: "color-mix(in srgb, var(--secondary-container) 55%, white)",
															color:
																card.tagTone === "urgent"
																	? "var(--tertiary-container)"
																	: card.tagTone === "primary"
																		? "var(--on-primary-fixed)"
																		: "var(--on-secondary-container)",
														}}
													>
														{card.tag}
													</span>
												) : null}
												<p className="mt-3 text-sm leading-6 font-medium text-[var(--on-surface)]">
													{card.title}
												</p>
												<div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium text-[var(--on-surface-variant)]">
													{card.meta.map((item) => {
														const Icon = item.icon;
														const isCompact = "compact" in item && item.compact;

														return (
															<span
																key={item.label}
																className={[
																	"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5",
																	isCompact
																		? "bg-[var(--primary-fixed)] text-[var(--on-primary-fixed)]"
																		: "bg-[var(--surface-container)]",
																].join(" ")}
															>
																{Icon ? <Icon className="h-3.5 w-3.5" /> : null}
																{item.label}
															</span>
														);
													})}
												</div>
											</article>
										))}
									</div>

									<button
										type="button"
										className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--surface-container-lowest)] px-4 py-3 text-sm font-medium text-[var(--on-surface-variant)]"
									>
										<Plus className="h-4 w-4" />
										Add a card
									</button>
								</section>
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
