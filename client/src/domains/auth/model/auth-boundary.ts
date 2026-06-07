import { getAuthLogoutUrl } from "#/domains/auth/model/auth-client";
import {
	clearAuthSession,
	getStoredAuthSession,
	hasActiveAuthSession,
	initOpenIdClient,
	isAuthenticationBypassPath,
	isAuthSessionExpired,
	loginWithOpenIdClient,
	refreshStoredAuthSession,
	type StoredAuthSession,
} from "#/domains/auth/model/openid-client";

const missingAccessTokenErrorMessage =
	"Missing authenticated session access token.";

export type AuthStatus = "authenticated" | "anonymous";

export type AuthBoundary = {
	status: AuthStatus;
	accessToken(): Promise<string>;
	refreshAccessToken(): Promise<string>;
	requirePage(returnToPath?: string): Promise<void>;
	completeCallback(): Promise<void>;
	logout(): void;
	isBypassPath(pathname: string): boolean;
};

export type AuthBoundaryAdapters = {
	clearSession(): void;
	completeCallback(): Promise<void>;
	getLogoutUrl(origin: string): string;
	getSession(): StoredAuthSession | null;
	hasActiveSession(): boolean;
	isBypassPath(pathname: string, origin: string): boolean;
	login(origin: string, returnToPath?: string): Promise<void>;
	refreshSession(): Promise<StoredAuthSession>;
};

export class AuthBoundaryAccessTokenError extends Error {
	constructor(message = missingAccessTokenErrorMessage) {
		super(message);
		this.name = "AuthBoundaryAccessTokenError";
	}
}

const defaultAdapters: AuthBoundaryAdapters = {
	clearSession: clearAuthSession,
	completeCallback: initOpenIdClient,
	getLogoutUrl: getAuthLogoutUrl,
	getSession: getStoredAuthSession,
	hasActiveSession: hasActiveAuthSession,
	isBypassPath: isAuthenticationBypassPath,
	login: loginWithOpenIdClient,
	refreshSession: refreshStoredAuthSession,
};

function getCurrentOrigin(): string {
	return typeof window === "undefined"
		? "http://localhost:3000"
		: window.location.origin;
}

function getCurrentReturnToPath(): string {
	if (typeof window === "undefined") {
		return "/";
	}

	return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

async function beginSessionRecovery(
	adapters: AuthBoundaryAdapters,
): Promise<never> {
	adapters.clearSession();
	await adapters.login(getCurrentOrigin(), getCurrentReturnToPath());
	throw new AuthBoundaryAccessTokenError();
}

function readAccessToken(session: StoredAuthSession | null): string | null {
	return session?.accessToken?.trim() || null;
}

export function createAuthBoundary(
	adapters: AuthBoundaryAdapters = defaultAdapters,
): AuthBoundary {
	let refreshAccessTokenPromise: Promise<string> | null = null;

	async function refreshAccessTokenOnce(): Promise<string> {
		try {
			const accessToken = readAccessToken(await adapters.refreshSession());

			if (accessToken) {
				return accessToken;
			}
		} catch {
			// Fall through to the shared stale-session recovery path.
		}

		return beginSessionRecovery(adapters);
	}

	return {
		get status() {
			return adapters.hasActiveSession() ? "authenticated" : "anonymous";
		},
		async accessToken() {
			const session = adapters.getSession();
			const accessToken = readAccessToken(session);

			if (!accessToken || (session && isAuthSessionExpired(session))) {
				return this.refreshAccessToken();
			}

			return accessToken;
		},
		async refreshAccessToken() {
			if (!refreshAccessTokenPromise) {
				refreshAccessTokenPromise = refreshAccessTokenOnce().finally(() => {
					refreshAccessTokenPromise = null;
				});
			}

			return refreshAccessTokenPromise;
		},
		async requirePage(returnToPath = "/") {
			if (adapters.hasActiveSession()) {
				return;
			}

			await adapters.login(getCurrentOrigin(), returnToPath);
		},
		async completeCallback() {
			await adapters.completeCallback();
		},
		logout() {
			const logoutUrl = adapters.getLogoutUrl(getCurrentOrigin());
			adapters.clearSession();
			window.location.assign(logoutUrl);
		},
		isBypassPath(pathname: string) {
			return adapters.isBypassPath(pathname, getCurrentOrigin());
		},
	};
}

const defaultAuthBoundary = createAuthBoundary();

export function useAuthBoundary(): AuthBoundary {
	return defaultAuthBoundary;
}
