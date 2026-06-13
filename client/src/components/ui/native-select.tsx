import { ChevronDownIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

type NativeSelectProps = Omit<React.ComponentProps<"select">, "size"> & {
	size?: "sm" | "default";
};

function NativeSelect({
	className,
	size = "default",
	...props
}: NativeSelectProps) {
	return (
		<div
			className={cn(
				"group/native-select relative w-full has-[select:disabled]:opacity-50",
				className,
			)}
			data-slot="native-select-wrapper"
			data-size={size}
		>
			<select
				data-slot="native-select"
				data-size={size}
				className="w-full min-w-0 appearance-none rounded-lg border border-input bg-[var(--surface)] px-4 py-3 pr-10 text-base text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive"
				{...props}
			/>
			<ChevronDownIcon
				className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground select-none"
				aria-hidden="true"
				data-slot="native-select-icon"
			/>
		</div>
	);
}

function NativeSelectOption({
	className,
	...props
}: React.ComponentProps<"option">) {
	return (
		<option
			data-slot="native-select-option"
			className={cn("bg-[Canvas] text-[CanvasText]", className)}
			{...props}
		/>
	);
}

function NativeSelectOptGroup({
	className,
	...props
}: React.ComponentProps<"optgroup">) {
	return (
		<optgroup
			data-slot="native-select-optgroup"
			className={cn("bg-[Canvas] text-[CanvasText]", className)}
			{...props}
		/>
	);
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
