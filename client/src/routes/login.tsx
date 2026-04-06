import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	ChevronRight,
	ExternalLink,
	KeyRound,
	ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
	authClientId,
	authIssuer,
	authRealm,
	authScopes,
	authServerUrl,
	authSuccessPath,
} from "#/lib/auth-client";
import {
	hasActiveAuthSession,
	loginWithOpenIdClient,
} from "#/lib/openid-client";

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

const clientEnvSnippet = `VITE_AUTH_ISSUER=http://localhost:7080/realms/master
VITE_AUTH_CLIENT_ID=kanai
VITE_AUTH_SCOPES=openid,profile,email
VITE_AUTH_SUCCESS_PATH=/auth/callback
VITE_AUTH_ERROR_PATH=/login`;

const authorizeSnippet = `const config = await client.discovery(
	new URL("http://localhost:7080/realms/master"),
	"kanai",
	{ token_endpoint_auth_method: "none" },
	client.None(),
)

const codeVerifier = client.randomPKCECodeVerifier()
const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)
const state = client.randomState()
const nonce = client.randomNonce()

const authorizationUrl = client.buildAuthorizationUrl(config, {
	redirect_uri: "http://localhost:3000/auth/callback",
	scope: "openid profile email",
	code_challenge: codeChallenge,
	code_challenge_method: "S256",
	state,
	nonce,
})

window.location.assign(authorizationUrl.href)`;

function LoginPage() {
	const search = Route.useSearch();
	const [isSigningIn, setIsSigningIn] = useState(false);
	const [clientError, setClientError] = useState<string | null>(null);

	const currentError =
		search.error ?? search.reason ?? search.message ?? clientError;
	const currentOrigin =
		typeof window === "undefined"
			? "http://localhost:3000"
			: window.location.origin;
	const providerLabel = "your identity provider";

	async function handleSignIn() {
		setClientError(null);
		setIsSigningIn(true);

		try {
			await loginWithOpenIdClient(currentOrigin, "/");
		} catch (error) {
			setClientError(
				error instanceof Error
					? error.message
					: "Could not start the sign-in flow.",
			);
			setIsSigningIn(false);
		}
	}

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		if (hasActiveAuthSession()) {
			window.location.replace("/");
			return;
		}

		if (currentError || isSigningIn) {
			return;
		}

		setClientError(null);
		setIsSigningIn(true);

		void loginWithOpenIdClient(currentOrigin, "/").catch((error) => {
			setClientError(
				error instanceof Error
					? error.message
					: "Could not start the sign-in flow.",
			);
			setIsSigningIn(false);
		});
	}, [currentError, currentOrigin, isSigningIn]);

	return (
		<main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
			<div className="page-wrap">
				<div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-[var(--on-surface-variant)]">
					<Link to="/" className="no-underline">
						Workspace
					</Link>
					<ChevronRight className="h-4 w-4" />
					<span>Secure Access</span>
				</div>

				<div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
					<section className="island-shell rise-in rounded-[2rem] p-6 sm:p-8 lg:p-10">
						<div className="inline-flex items-center gap-2 rounded-full bg-[var(--primary-fixed)] px-3 py-1.5 text-xs font-semibold tracking-[0.18em] text-[var(--on-primary-fixed)] uppercase">
							<ShieldCheck className="h-4 w-4" />
							Direct OIDC Login
						</div>

						<h1 className="display-title mt-5 max-w-3xl text-4xl font-bold tracking-tight text-[var(--on-surface)] sm:text-5xl">
							Access the Kanai workspace through {providerLabel}.
						</h1>

						<p className="mt-5 max-w-2xl text-base leading-8 text-[var(--sea-ink-soft)] sm:text-lg">
							This sign-in flow starts the browser-side Authorization Code +
							PKCE exchange directly against your OIDC provider, keeping the
							experience aligned with the board-first interface.
						</p>

						{currentError ? (
							<div className="mt-6 rounded-[1.25rem] bg-[color:color-mix(in_srgb,var(--tertiary-container)_10%,white)] px-4 py-3 text-sm text-[var(--tertiary-container)]">
								{currentError}
							</div>
						) : null}

						<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
							<button
								type="button"
								onClick={handleSignIn}
								disabled={isSigningIn}
								className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-container))] px-5 py-3 text-sm font-semibold text-[var(--on-primary)] shadow-[0_18px_36px_rgba(12,86,208,0.18)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-75"
							>
								<KeyRound className="h-4 w-4" />
								{isSigningIn
									? "Redirecting..."
									: `Continue with ${providerLabel}`}
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
							<div className="rounded-[1.5rem] bg-[var(--surface-container)] p-4">
								<p className="text-xs font-semibold tracking-[0.16em] text-[var(--on-surface-variant)] uppercase">
									Client
								</p>
								<p className="mt-2 text-sm text-[var(--on-surface)]">
									<code>{authClientId ?? "missing"}</code>
								</p>
							</div>
							<div className="rounded-[1.5rem] bg-[var(--surface-container)] p-4">
								<p className="text-xs font-semibold tracking-[0.16em] text-[var(--on-surface-variant)] uppercase">
									Scopes
								</p>
								<p className="mt-2 text-sm text-[var(--on-surface)]">
									<code>{authScopes.join(" ")}</code>
								</p>
							</div>
							<div className="rounded-[1.5rem] bg-[var(--surface-container)] p-4">
								<p className="text-xs font-semibold tracking-[0.16em] text-[var(--on-surface-variant)] uppercase">
									Success Path
								</p>
								<p className="mt-2 text-sm text-[var(--on-surface)]">
									<code>{authSuccessPath}</code>
								</p>
							</div>
							<div className="rounded-[1.5rem] bg-[var(--surface-container)] p-4">
								<p className="text-xs font-semibold tracking-[0.16em] text-[var(--on-surface-variant)] uppercase">
									Issuer
								</p>
								<p className="mt-2 text-sm text-[var(--on-surface)]">
									<code>{authIssuer ?? "missing"}</code>
								</p>
							</div>
						</div>
					</section>

					<section className="grid gap-4">
						<article
							className="island-shell rise-in rounded-[1.75rem] p-6"
							style={{ animationDelay: "80ms" }}
						>
							<p className="island-kicker mb-2">Client Wiring</p>
							<p className="m-0 text-sm leading-7 text-[var(--sea-ink-soft)]">
								Expose the auth issuer and client id in the Vite environment so
								`openid-client` can discover the realm before the router hands
								off the redirect.
							</p>
							<pre className="mt-4 overflow-x-auto rounded-[1.25rem] bg-[var(--surface-container)] p-4 text-sm text-[var(--on-surface)]">
								<code>{clientEnvSnippet}</code>
							</pre>
							<p className="mt-4 text-sm leading-7 text-[var(--sea-ink-soft)]">
								Current auth config:{" "}
								<code>
									{authServerUrl && authRealm
										? `${authServerUrl} (realm ${authRealm})`
										: "missing or invalid VITE_AUTH_ISSUER"}
								</code>
							</p>
						</article>

						<article
							className="island-shell rise-in rounded-[1.75rem] p-6"
							style={{ animationDelay: "150ms" }}
						>
							<p className="island-kicker mb-2">OIDC Flow</p>
							<p className="m-0 text-sm leading-7 text-[var(--sea-ink-soft)]">
								This is the browser-side `openid-client` sequence behind the
								sign-in action.
							</p>
							<pre className="mt-4 overflow-x-auto rounded-[1.25rem] bg-[var(--surface-container)] p-4 text-sm text-[var(--on-surface)]">
								<code>{authorizeSnippet}</code>
							</pre>
						</article>

						<article
							className="island-shell rise-in rounded-[1.75rem] p-6"
							style={{ animationDelay: "220ms" }}
						>
							<p className="island-kicker mb-2">Auth Checklist</p>
							<ul className="m-0 list-disc space-y-2 pl-5 text-sm leading-7 text-[var(--sea-ink-soft)]">
								<li>
									Set <code>VITE_AUTH_ISSUER</code> to your realm issuer, for
									example <code>http://localhost:7080/realms/MyRealm</code>.
								</li>
								<li>
									Register the redirect URL as{" "}
									<code>
										{currentOrigin}
										{authSuccessPath}
									</code>
									in your identity provider client.
								</li>
								<li>
									Use a public client with standard flow enabled so the browser
									can exchange the authorization code.
								</li>
								<li>
									Keep the PKCE verifier, state, and nonce tied to the browser
									session until the callback returns.
								</li>
								<li>
									Keep the requested scopes aligned with your identity provider
									client.
								</li>
							</ul>
							<a
								href="https://github.com/panva/openid-client/blob/main/README.md"
								target="_blank"
								rel="noreferrer"
								className="mt-5 inline-flex items-center gap-2 text-sm font-semibold no-underline"
							>
								Open openid-client docs
								<ExternalLink className="h-4 w-4" />
							</a>
						</article>
					</section>
				</div>
			</div>
		</main>
	);
}
