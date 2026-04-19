import { Link } from "@tanstack/react-router";
import { ArrowRight, KeyRound, ShieldCheck } from "lucide-react";

import { AuthInfoCard } from "#/domains/auth/ui/atoms/AuthInfoCard";

type LoginHeroProps = {
	authClientId: string;
	authIssuer: string;
	authScopes: string[];
	authSuccessPath: string;
	currentError: string | null;
	isSigningIn: boolean;
	onSignIn: () => void;
	providerLabel: string;
};

export function LoginHero({
	authClientId,
	authIssuer,
	authScopes,
	authSuccessPath,
	currentError,
	isSigningIn,
	onSignIn,
	providerLabel,
}: LoginHeroProps) {
	return (
		<section className="island-shell rise-in rounded-[2rem] p-6 sm:p-8 lg:p-10">
			<div className="inline-flex items-center gap-2 rounded-full bg-[var(--primary-fixed)] px-3 py-1.5 text-xs font-semibold tracking-[0.18em] text-[var(--on-primary-fixed)] uppercase">
				<ShieldCheck className="h-4 w-4" />
				Direct OIDC Login
			</div>

			<h1 className="display-title mt-5 max-w-3xl text-4xl font-bold tracking-tight text-[var(--on-surface)] sm:text-5xl">
				Access the Kanai workspace through {providerLabel}.
			</h1>

			<p className="mt-5 max-w-2xl text-base leading-8 text-[var(--sea-ink-soft)] sm:text-lg">
				This sign-in flow starts the browser-side Authorization Code + PKCE
				exchange directly against your OIDC provider, keeping the experience
				aligned with the board-first interface.
			</p>

			{currentError ? (
				<div className="mt-6 rounded-[1.25rem] bg-[color:color-mix(in_srgb,var(--tertiary-container)_10%,white)] px-4 py-3 text-sm text-[var(--tertiary-container)]">
					{currentError}
				</div>
			) : null}

			<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
				<button
					type="button"
					onClick={onSignIn}
					disabled={isSigningIn}
					className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-container))] px-5 py-3 text-sm font-semibold text-[var(--on-primary)] shadow-[0_18px_36px_rgba(12,86,208,0.18)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-75"
				>
					<KeyRound className="h-4 w-4" />
					{isSigningIn ? "Redirecting..." : `Continue with ${providerLabel}`}
					<ArrowRight className="h-4 w-4" />
				</button>

				<Link
					to="/"
					className="inline-flex items-center justify-center rounded-full bg-[var(--surface-container)] px-5 py-3 text-sm font-semibold text-[var(--on-surface)] no-underline"
				>
					Back to board
				</Link>
			</div>

			<div className="mt-8 grid gap-3 sm:grid-cols-2">
				<AuthInfoCard label="Client" value={authClientId} />
				<AuthInfoCard label="Scopes" value={authScopes.join(" ")} />
				<AuthInfoCard label="Success Path" value={authSuccessPath} />
				<AuthInfoCard label="Issuer" value={authIssuer} />
			</div>
		</section>
	);
}
