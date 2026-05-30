import type { LucideIcon } from "lucide-react";

export type SidebarItem = {
	label: string;
	icon: LucideIcon;
	active?: boolean;
	to?: string;
};

export type BoardMetaItem = {
	label: string;
	icon?: LucideIcon;
	compact?: boolean;
};

export type BoardCardData = {
	tag: string | null;
	tagTone: "primary" | "urgent" | "neutral";
	title: string;
	meta: BoardMetaItem[];
};

export type BoardColumnData = {
	title: string;
	count: number;
	cards: BoardCardData[];
};
