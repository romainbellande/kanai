import type * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"flex w-full resize-none rounded-lg border border-input bg-[var(--surface)] px-4 py-3 text-base text-foreground outline-none transition placeholder:text-[var(--outline)] focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
