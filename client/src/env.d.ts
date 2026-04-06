/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_AUTH_ISSUER?: string;
	readonly VITE_AUTH_CLIENT_ID?: string;
	readonly VITE_AUTH_SCOPES?: string;
	readonly VITE_AUTH_SUCCESS_PATH?: string;
	readonly VITE_AUTH_ERROR_PATH?: string;
	readonly VITE_BETTER_AUTH_URL?: string;
	readonly VITE_BETTER_AUTH_KEYCLOAK_PROVIDER_ID?: string;
	readonly VITE_BETTER_AUTH_SCOPES?: string;
	readonly VITE_BETTER_AUTH_SUCCESS_PATH?: string;
	readonly VITE_BETTER_AUTH_ERROR_PATH?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
