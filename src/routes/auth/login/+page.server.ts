/**
 * Expert Portal Login Page Server
 * Handles authentication status checks and Google OAuth dispatch.
 */

import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getCurrentUser, getAuthUrl } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	const userId = await getCurrentUser(event);
	if (userId) {
		throw redirect(302, '/dashboard');
	}

	const env = event.platform?.env;
	const hasGoogleOAuth = !!(env?.GOOGLE_CLIENT_ID && env?.APP_URL);

	return {
		hasGoogleOAuth,
		appUrl: env?.APP_URL || 'https://booking.neubofy.in'
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
	}
};
