import { getAuthLogoutUrl } from "#/domains/auth/model/auth-client";
import {
	clearAuthSession,
	getStoredAuthSession,
	hasActiveAuthSession,
	initOpenIdClient,
	isAuthenticationBypassPath,
	loginWithOpenIdClient,
	type StoredAuthSession,
} from "#/domains/auth/model/openid-client";

const missingAccessTokenErrorMessage =
	"Missing authenticated session access token.";

export type AuthStatus = "authenticated" | "anonymous";

export type AuthBoundary = {
	status: AuthStatus;
	accessToken(): Promise<string>;
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
};

function getCurrentOrigin(): string {
	return typeof window === "undefined"
		? "http://localhost:3000"
		: window.location.origin;
}

export function createAuthBoundary(
	adapters: AuthBoundaryAdapters = defaultAdapters,
): AuthBoundary {
	return {
		get status() {
			return adapters.hasActiveSession() ? "authenticated" : "anonymous";
		},
		async accessToken() {
			const accessToken = adapters.getSession()?.accessToken?.trim();

			if (!accessToken) {
				throw new AuthBoundaryAccessTokenError();
			}

			return accessToken;
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
