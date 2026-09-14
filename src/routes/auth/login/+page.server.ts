/**
 * Expert Portal Login Page Server
 * Handles authentication status checks, Google OAuth dispatch,
 * and dev/demo Super Admin access without throwing unhandled 500 errors.
 */

import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getCurrentUser, getAuthUrl, createSessionToken } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	const userId = await getCurrentUser(event);
	if (userId) {
		throw redirect(302, '/dashboard');
	}

	const env = event.platform?.env;
	const hasGoogleOAuth = !!(env?.GOOGLE_CLIENT_ID && env?.APP_URL);

	return {
		hasGoogleOAuth,
		appUrl: env?.APP_URL || 'https://booking.neubofy.in',
		hasDevMode: !hasGoogleOAuth || process.env.NODE_ENV !== 'production'
	};
};

export const actions: Actions = {
	google: async ({ platform }) => {
		const env = platform?.env;
		const clientId = env?.GOOGLE_CLIENT_ID;
		const appUrl = env?.APP_URL;

		if (!clientId || !appUrl) {
			return fail(400, {
				missingOAuth: true,
				error: 'Google OAuth configuration is missing. Please define GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and APP_URL in your environment.'
			});
		}

		if (!env.KV) {
			return fail(500, {
				error: 'KV Storage is not initialized in the current environment.'
			});
		}

		const state = crypto.randomUUID();
		await env.KV.put(`oauth_state:${state}`, 'login', { expirationTtl: 600 });
		const redirectUri = `${appUrl}/auth/callback`;
		const authUrl = getAuthUrl(clientId, redirectUri, state);
		throw redirect(302, authUrl);
	},

	devLogin: async ({ cookies, platform }) => {
		const db = platform?.env?.DB;
		if (!db) {
			return fail(500, {
				error: 'Database connection is not available in current platform environment.'
			});
		}

		try {
			// 1. Ensure organization exists
			let org = await db
				.prepare('SELECT id, name FROM organizations ORDER BY created_at LIMIT 1')
				.first<{ id: string; name: string }>();

			if (!org) {
				await db
					.prepare(
						`INSERT INTO organizations (id, name, slug, brand_color, contact_email, setup_complete)
						 VALUES ('org_neubofy_main', 'Neubofy™', 'neubofy', '#3b82f6', 'contact@neubofy.in', 1)`
					)
					.run();
				org = { id: 'org_neubofy_main', name: 'Neubofy™' };
			}

			// 2. Ensure Super Admin user exists
			const adminEmail = 'admin@neubofy.in';
			let user = await db
				.prepare('SELECT id FROM users WHERE email = ?')
				.bind(adminEmail)
				.first<{ id: string }>();

			let userId = user?.id;
			if (!userId) {
				userId = 'usr_superadmin';
				await db
					.prepare(
						`INSERT INTO users (id, email, name, slug, role_title, bio, is_active, is_free_consultation, created_at)
						 VALUES (?, ?, 'Super Admin', 'super-admin', 'Chief Technology Officer', 'Lead Systems Architect & Technology Advisor at Neubofy.', 1, 1, CURRENT_TIMESTAMP)`
					)
					.bind(userId, adminEmail)
					.run();
			}

			// 3. Ensure organization membership exists as Owner
			const member = await db
				.prepare('SELECT id FROM organization_members WHERE user_id = ? AND organization_id = ?')
				.bind(userId, org.id)
				.first();

			if (!member) {
				await db
					.prepare(
						`INSERT INTO organization_members (id, organization_id, user_id, role, is_active, created_at)
						 VALUES ('mem_superadmin', ?, ?, 'owner', 1, CURRENT_TIMESTAMP)`
					)
					.bind(org.id, userId)
					.run();
			}

			// 4. Create and set session cookie
			const jwtSecret = platform?.env?.JWT_SECRET || 'neubofy-dev-jwt-secret-fallback-2026';
			const sessionToken = await createSessionToken(userId, jwtSecret);

			cookies.set('session', sessionToken, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: false, // allows local dev testing on http://localhost
				maxAge: 7 * 24 * 60 * 60
			});

			throw redirect(302, '/dashboard');
		} catch (err: any) {
			if (err?.status === 302 || err?.location) throw err;
			console.error('Dev login error:', err);
			return fail(500, {
				error: err.message || 'Failed to initialize Super Admin session.'
			});
		}
	}
};
