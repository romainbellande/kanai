import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
	component: About,
});

function About() {
	return (
		<main className="page-wrap px-4 py-12 sm:py-16">
			<section className="island-shell rounded-[1.75rem] p-6 sm:p-8">
				<p className="island-kicker mb-3">About Kanai</p>
				<h1 className="display-title mb-4 text-4xl font-bold tracking-tight text-[var(--on-surface)] sm:text-5xl">
					A premium board workspace for strategic delivery.
				</h1>
				<p className="max-w-3xl text-base leading-8 text-[var(--sea-ink-soft)]">
					Kanai now uses the `Linearis Professional` design system and the
					`Project Board View` layout as its default application surface. The
					interface favors tonal layering, editorial typography, and generous
					spacing over hard separators.
				</p>
				<div className="mt-6 flex flex-wrap gap-3">
					<Link
						to="/"
						className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-container))] px-5 py-2.5 text-sm font-semibold text-[var(--on-primary)] no-underline shadow-[0_18px_36px_rgba(12,86,208,0.18)]"
					>
						Open Board
					</Link>
					<Link
						to="/login"
						className="inline-flex items-center justify-center rounded-full bg-[var(--surface-container-low)] px-5 py-2.5 text-sm font-semibold text-[var(--on-surface)] no-underline"
					>
						Sign In
					</Link>
				</div>
			</section>
		</main>
	);
}
