import { createFileRoute, Link } from "@tanstack/react-router";

import { WorkspaceLayout } from "#/domains/workspace/ui/templates/WorkspaceLayout";

export const Route = createFileRoute("/404")({ component: NotFoundPage });

export function NotFoundPage() {
	return (
		<WorkspaceLayout
			pageDescription="The page or workspace item you requested could not be found."
			pageTitle="Page not found"
			contentContainerClassName="mx-auto flex max-w-[760px] flex-col gap-8"
		>
			<section className="rounded-[1.75rem] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-6 shadow-sm sm:p-10">
				<p className="text-sm leading-6 text-[var(--on-surface-variant)]">
					The link may be stale, or the item may no longer exist.
				</p>
				<Link
					to="/"
					className="mt-6 inline-flex rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-[color:var(--on-primary)] no-underline transition hover:brightness-105"
				>
					Go to Projects
				</Link>
			</section>
		</WorkspaceLayout>
	);
}
