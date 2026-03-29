import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ExternalLink, KeyRound, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import {
	authClient,
	authErrorPath,
	authSuccessPath,
	betterAuthUrl,
	keycloakProviderId,
	keycloakScopes,
} from "#/lib/auth-client";

type LoginSearch = {
	error?: string;
	message?: string;
	reason?: string;
};

export const Route = createFileRoute("/login")({
	validateSearch: (search): LoginSearch => ({
		error: typeof search.error === "string" ? search.error : undefined,
		message: typeof search.message === "string" ? search.message : undefined,
		reason: typeof search.reason === "string" ? search.reason : undefined,
	}),
	component: LoginPage,
});

const clientEnvSnippet = `VITE_BETTER_AUTH_URL=http://localhost:3000
VITE_BETTER_AUTH_KEYCLOAK_PROVIDER_ID=keycloak
VITE_BETTER_AUTH_SCOPES=openid,profile,email
VITE_BETTER_AUTH_SUCCESS_PATH=/
VITE_BETTER_AUTH_ERROR_PATH=/login`;

const serverSnippet = `import { betterAuth } from "better-auth"
import { genericOAuth, keycloak } from "better-auth/plugins"

export const auth = betterAuth({
	plugins: [
		genericOAuth({
			config: [
				keycloak({
					clientId: process.env.KEYCLOAK_CLIENT_ID!,
					clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
					issuer: process.env.KEYCLOAK_ISSUER!,
					scopes: ["openid", "profile", "email"],
				}),
			],
		}),
	],
})`;

function LoginPage() {
	const search = Route.useSearch();
	const [isSigningIn, setIsSigningIn] = useState(false);
	const [clientError, setClientError] = useState<string | null>(null);

	const currentError =
		search.error ?? search.reason ?? search.message ?? clientError;
	const providerLabel = useMemo(
		() =>
			keycloakProviderId
				.replace(/[-_]+/g, " ")
				.replace(/\b\w/g, (char) => char.toUpperCase()),
		[],
	);

	async function handleSignIn() {
		setClientError(null);
		setIsSigningIn(true);

		const result = await authClient.signIn.oauth2({
			providerId: keycloakProviderId,
			callbackURL: authSuccessPath,
			errorCallbackURL: authErrorPath,
			scopes: keycloakScopes,
		});

		if (result.error) {
			setClientError(
				result.error.message ?? "Could not start the Keycloak sign-in flow.",
			);
			setIsSigningIn(false);
		}
	}

	return (
		<main className="page-wrap px-4 py-10 sm:py-14">
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
				<section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-8 sm:px-10 sm:py-10">
					<div className="pointer-events-none absolute inset-x-10 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(79,184,178,0.2),transparent_72%)]" />
					<div className="pointer-events-none absolute -right-20 top-14 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_70%)]" />
					<div className="relative">
						<div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-xs font-semibold tracking-[0.18em] text-[var(--kicker)] uppercase shadow-[0_10px_25px_rgba(30,90,72,0.08)]">
							<ShieldCheck className="h-4 w-4" />
							Better Auth + Keycloak
						</div>
						<h1 className="display-title max-w-2xl text-4xl leading-[1.02] font-bold tracking-tight text-[var(--sea-ink)] sm:text-6xl">
							Sign in through {providerLabel}.
						</h1>
						<p className="mt-5 max-w-2xl text-base leading-8 text-[var(--sea-ink-soft)] sm:text-lg">
							This page starts Better Auth&apos;s generic OAuth flow with the
							pre-configured Keycloak provider so your app can hand off
							authentication without custom redirect plumbing.
						</p>

						{currentError ? (
							<div className="mt-6 rounded-2xl border border-[rgba(168,67,54,0.24)] bg-[rgba(168,67,54,0.09)] px-4 py-3 text-sm text-[color:color-mix(in_oklab,var(--sea-ink)_70%,#7a2116)]">
								{currentError}
							</div>
						) : null}

						<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
							<button
								type="button"
								onClick={handleSignIn}
								disabled={isSigningIn}
								className="inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.16)] px-5 py-3 text-sm font-semibold text-[var(--lagoon-deep)] shadow-[0_14px_30px_rgba(50,143,151,0.14)] no-underline transition hover:-translate-y-0.5 hover:bg-[rgba(79,184,178,0.24)] disabled:translate-y-0 disabled:cursor-wait disabled:opacity-75"
							>
								<KeyRound className="h-4 w-4" />
								{isSigningIn
									? "Redirecting..."
									: `Continue with ${providerLabel}`}
								<ArrowRight className="h-4 w-4" />
							</button>
							<Link
								to="/"
								className="inline-flex items-center justify-center rounded-full border border-[var(--line)] bg-white/55 px-5 py-3 text-sm font-semibold text-[var(--sea-ink)] no-underline transition hover:-translate-y-0.5 hover:border-[rgba(23,58,64,0.3)]"
							>
								Back home
							</Link>
						</div>

						<div className="mt-8 flex flex-wrap gap-2 text-sm text-[var(--sea-ink-soft)]">
							<span className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5">
								Provider <code>{keycloakProviderId}</code>
							</span>
							<span className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5">
								Scopes <code>{keycloakScopes.join(" ")}</code>
							</span>
							<span className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5">
								Success <code>{authSuccessPath}</code>
							</span>
						</div>
					</div>
				</section>

				<section className="grid gap-4">
					<article
						className="island-shell rise-in rounded-[1.75rem] p-6"
						style={{ animationDelay: "90ms" }}
					>
						<p className="island-kicker mb-2">Client wiring</p>
						<p className="m-0 text-sm leading-7 text-[var(--sea-ink-soft)]">
							Point the Better Auth client at your auth server and keep the
							Keycloak provider id aligned with the backend plugin config.
						</p>
						<pre className="mt-4 overflow-x-auto rounded-2xl border border-[var(--line)] bg-[rgba(255,255,255,0.45)] p-4 text-sm text-[var(--sea-ink)]">
							<code>{clientEnvSnippet}</code>
						</pre>
						<p className="mt-4 text-sm leading-7 text-[var(--sea-ink-soft)]">
							Current auth target:{" "}
							<code>{betterAuthUrl ?? "current origin + /api/auth"}</code>
						</p>
					</article>

					<article
						className="island-shell rise-in rounded-[1.75rem] p-6"
						style={{ animationDelay: "160ms" }}
					>
						<p className="island-kicker mb-2">Generic OAuth plugin</p>
						<p className="m-0 text-sm leading-7 text-[var(--sea-ink-soft)]">
							This is the server-side Better Auth setup that matches the button
							on this page.
						</p>
						<pre className="mt-4 overflow-x-auto rounded-2xl border border-[var(--line)] bg-[rgba(255,255,255,0.45)] p-4 text-sm text-[var(--sea-ink)]">
							<code>{serverSnippet}</code>
						</pre>
					</article>

					<article
						className="island-shell rise-in rounded-[1.75rem] p-6"
						style={{ animationDelay: "230ms" }}
					>
						<p className="island-kicker mb-2">Keycloak checklist</p>
						<ul className="m-0 list-disc space-y-2 pl-5 text-sm leading-7 text-[var(--sea-ink-soft)]">
							<li>
								Set <code>KEYCLOAK_ISSUER</code> to your realm issuer, for
								example <code>http://localhost:7080/realms/MyRealm</code>.
							</li>
							<li>
								Register the callback URL as{" "}
								<code>
									BETTER_AUTH_URL/api/auth/oauth2/callback/{keycloakProviderId}
								</code>
								.
							</li>
							<li>
								Keep the requested scopes aligned with your Keycloak client.
							</li>
							<li>
								Use Better Auth&apos;s docs if you want to expand this into
								account linking or multiple providers.
							</li>
						</ul>
						<a
							href="https://better-auth.com/docs/plugins/generic-oauth#example-using-pre-configured-providers"
							target="_blank"
							rel="noreferrer"
							className="mt-5 inline-flex items-center gap-2 text-sm font-semibold no-underline"
						>
							Open Better Auth docs
							<ExternalLink className="h-4 w-4" />
						</a>
					</article>
				</section>
			</div>
		</main>
	);
}
