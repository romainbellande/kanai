/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API_BASE_URL?: string;
	readonly VITE_AUTH_ISSUER?: string;
	readonly VITE_AUTH_CLIENT_ID?: string;
	readonly VITE_AUTH_SCOPES?: string;
	readonly VITE_AUTH_SUCCESS_PATH?: string;
	readonly VITE_AUTH_ERROR_PATH?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
