import { ExternalLink } from "lucide-react";

type LoginGuidesProps = {
	authRealm?: string;
	authServerUrl?: string;
	authSuccessPath: string;
	currentOrigin: string;
};

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

export function LoginGuides({
	authRealm,
	authServerUrl,
	authSuccessPath,
	currentOrigin,
}: LoginGuidesProps) {
	return (
		<section className="grid gap-4">
			<article
				className="island-shell rise-in rounded-[1.75rem] p-6"
				style={{ animationDelay: "80ms" }}
			>
				<p className="island-kicker mb-2">Client Wiring</p>
				<p className="m-0 text-sm leading-7 text-[var(--sea-ink-soft)]">
					Expose the auth issuer and client id in the Vite environment so
					`openid-client` can discover the realm before the router hands off the
					redirect.
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
					This is the browser-side `openid-client` sequence behind the sign-in
					action.
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
						Set <code>VITE_AUTH_ISSUER</code> to your realm issuer, for example{" "}
						<code>http://localhost:7080/realms/MyRealm</code>.
					</li>
					<li>
						Register the redirect URL as{" "}
						<code>
							{currentOrigin}
							{authSuccessPath}
						</code>{" "}
						in your identity provider client.
					</li>
					<li>
						Use a public client with standard flow enabled so the browser can
						exchange the authorization code.
					</li>
					<li>
						Keep the PKCE verifier, state, and nonce tied to the browser session
						until the callback returns.
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
	);
}
