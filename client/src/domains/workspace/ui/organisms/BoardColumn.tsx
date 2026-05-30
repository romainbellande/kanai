import { MoreHorizontal, Plus } from "lucide-react";

import { WorkspaceIconButton } from "#/domains/workspace/ui/atoms/WorkspaceIconButton";
import { BoardCard } from "#/domains/workspace/ui/molecules/BoardCard";
import type { BoardColumnData } from "#/domains/workspace/ui/types";

type BoardColumnProps = {
	column: BoardColumnData;
	animationDelay: string;
};

export function BoardColumn({ column, animationDelay }: BoardColumnProps) {
	return (
		<section
			className="rise-in rounded-[1.5rem] bg-[var(--surface-container)] p-4 shadow-[0_18px_36px_rgba(25,28,30,0.04)]"
			style={{ animationDelay }}
		>
			<div className="flex items-center justify-between gap-3">
				<div>
					<h2 className="text-sm font-semibold text-[var(--on-surface-variant)]">
						{column.title}
					</h2>
					<p className="mt-1 text-xs text-[var(--outline)]">{column.count}</p>
				</div>
				<WorkspaceIconButton
					size="sm"
					className="bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)]"
				>
					<MoreHorizontal className="h-4 w-4" />
				</WorkspaceIconButton>
			</div>

			<div className="mt-4 space-y-4">
				{column.cards.map((card) => (
					<BoardCard key={card.title} card={card} />
				))}
			</div>

			<button
				type="button"
				className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--surface-container-lowest)] px-4 py-3 text-sm font-medium text-[var(--on-surface-variant)]"
			>
				<Plus className="h-4 w-4" />
				Add a task
			</button>
		</section>
	);
}
