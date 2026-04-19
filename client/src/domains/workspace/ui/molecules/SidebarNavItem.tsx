import type { SidebarItem } from "#/domains/workspace/ui/types";

type SidebarNavItemProps = SidebarItem;

export function SidebarNavItem({
	label,
	icon: Icon,
	active,
}: SidebarNavItemProps) {
	return (
		<div
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
	);
}
