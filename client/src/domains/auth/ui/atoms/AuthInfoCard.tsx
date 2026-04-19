type AuthInfoCardProps = {
	label: string;
	value: string;
};

export function AuthInfoCard({ label, value }: AuthInfoCardProps) {
	return (
		<div className="rounded-[1.5rem] bg-[var(--surface-container)] p-4">
			<p className="text-xs font-semibold tracking-[0.16em] text-[var(--on-surface-variant)] uppercase">
				{label}
			</p>
			<p className="mt-2 text-sm text-[var(--on-surface)]">
				<code>{value}</code>
			</p>
		</div>
	);
}
