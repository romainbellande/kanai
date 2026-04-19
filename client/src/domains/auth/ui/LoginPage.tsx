import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import {
	authClientId,
	authIssuer,
	authRealm,
	authScopes,
	authServerUrl,
	authSuccessPath,
} from "#/domains/auth/model/auth-client";
import {
	hasActiveAuthSession,
	loginWithOpenIdClient,
} from "#/domains/auth/model/openid-client";
import { LoginGuides } from "#/domains/auth/ui/organisms/LoginGuides";
import { LoginHero } from "#/domains/auth/ui/organisms/LoginHero";

type LoginPageProps = {
	error?: string;
	message?: string;
	reason?: string;
};

export function LoginPage({ error, message, reason }: LoginPageProps) {
	const [isSigningIn, setIsSigningIn] = useState(false);
	const [clientError, setClientError] = useState<string | null>(null);

	const currentError = error ?? reason ?? message ?? clientError;
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
		} catch (signInError) {
			setClientError(
				signInError instanceof Error
					? signInError.message
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

		void loginWithOpenIdClient(currentOrigin, "/").catch((signInError) => {
			setClientError(
				signInError instanceof Error
					? signInError.message
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
					<LoginHero
						authClientId={authClientId ?? "missing"}
						authIssuer={authIssuer ?? "missing"}
						authScopes={authScopes}
						authSuccessPath={authSuccessPath}
						currentError={currentError}
						isSigningIn={isSigningIn}
						onSignIn={handleSignIn}
						providerLabel={providerLabel}
					/>

					<LoginGuides
						authRealm={authRealm}
						authServerUrl={authServerUrl}
						authSuccessPath={authSuccessPath}
						currentOrigin={currentOrigin}
					/>
				</div>
			</div>
		</main>
	);
}
