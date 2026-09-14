/// <reference types="@sveltejs/kit" />
/// <reference types="@cloudflare/workers-types" />

declare global {
	namespace App {
		interface Platform {
			env: {
				DB: D1Database;
				KV: KVNamespace;
				GOOGLE_CLIENT_ID: string;
				GOOGLE_CLIENT_SECRET: string;
				JWT_SECRET: string;
				BASE_URL: string;
				APP_URL?: string;
				RESEND_API_KEY?: string;
				EMAIL_FROM?: string;
				EMAIL_REPLY_TO?: string;
				TURNSTILE_SECRET_KEY?: string;
				CRON_SECRET?: string;
				ORGANIZATION_OWNER_EMAIL?: string;
			};
			context: {
				waitUntil(promise: Promise<any>): void;
			};
			caches: CacheStorage & { default: Cache };
		}
		interface Locals {
			user?: {
				id: string;
				email: string;
				name: string;
			};
		}
		interface Error {
			message: string;
			reason?: string;
			permissionNeeded?: string;
			currentRole?: string;
			code?: string;
		}
	}
}

export {};