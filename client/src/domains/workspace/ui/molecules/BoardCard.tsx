import type { BoardCardData } from "#/domains/workspace/ui/types";

type BoardCardProps = {
	card: BoardCardData;
};

export function BoardCard({ card }: BoardCardProps) {
	return (
		<article className="rounded-[1rem] bg-[var(--surface-container-lowest)] p-4 shadow-[0_18px_34px_rgba(25,28,30,0.04)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-bright)] hover:shadow-[0_24px_40px_rgba(25,28,30,0.08)]">
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

					return (
						<span
							key={item.label}
							className={[
								"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5",
								item.compact
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
	);
}
