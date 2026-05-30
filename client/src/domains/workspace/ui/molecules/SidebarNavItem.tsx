import { Link } from "@tanstack/react-router";

import type { SidebarItem } from "#/domains/workspace/ui/types";

type SidebarNavItemProps = SidebarItem;

export function SidebarNavItem({
	label,
	icon: Icon,
	active,
	to,
}: SidebarNavItemProps) {
	const className = [
		"flex cursor-pointer items-center gap-3 rounded-full px-4 py-3 text-sm font-medium no-underline",
		active
			? "bg-[var(--primary-fixed)] text-[var(--on-primary-fixed)]"
			: "text-[var(--on-surface-variant)] hover:bg-[var(--surface-bright)]",
	].join(" ");

	const content = (
		<>
			<Icon className="h-4 w-4" />
			<span>{label}</span>
		</>
	);

	if (to) {
		return (
			<Link to={to} className={className}>
				{content}
			</Link>
		);
	}

	return <div className={className}>{content}</div>;
}
