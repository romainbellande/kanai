import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/auth/callback")({
	component: AuthCallbackPage,
});

function AuthCallbackPage() {
	useEffect(() => {
		// openid-client handles the code exchange before the router starts.
		window.location.replace("/");
	}, []);

	return (
		<main className="page-wrap px-4 py-10 sm:py-14">
			<section className="island-shell rise-in rounded-[2rem] px-6 py-8 text-center sm:px-10 sm:py-10">
				<p className="island-kicker mb-3">Authentication Callback</p>
				<h1 className="display-title text-3xl leading-tight font-bold text-[var(--sea-ink)] sm:text-4xl">
					Finishing sign-in...
				</h1>
				<p className="mt-4 text-sm leading-7 text-[var(--sea-ink-soft)] sm:text-base">
					Redirecting back to the app.
				</p>
			</section>
		</main>
	);
}
