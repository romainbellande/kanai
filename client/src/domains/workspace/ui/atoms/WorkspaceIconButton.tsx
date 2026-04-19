import type { ReactNode } from "react";

type WorkspaceIconButtonProps = {
	children: ReactNode;
	className?: string;
	size?: "sm" | "md";
};

export function WorkspaceIconButton({
	children,
	className,
	size = "md",
}: WorkspaceIconButtonProps) {
	return (
		<button
			type="button"
			className={[
				"inline-flex items-center justify-center rounded-full",
				size === "sm" ? "h-10 w-10" : "h-11 w-11",
				className,
			]
				.filter(Boolean)
				.join(" ")}
		>
			{children}
		</button>
	);
}
