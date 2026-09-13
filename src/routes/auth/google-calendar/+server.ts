import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUrl, getCurrentUser } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
	const userId = await getCurrentUser(event);
	const env = event.platform?.env;
	if (!userId) throw redirect(302, '/auth/login');
	if (!env?.GOOGLE_CLIENT_ID || !env.APP_URL) throw error(500, 'Missing OAuth configuration');
	const state = crypto.randomUUID();
	await env.KV.put(`oauth_state:${state}`, `calendar:${userId}`, { expirationTtl: 600 });
	throw redirect(302, getAuthUrl(env.GOOGLE_CLIENT_ID, `${env.APP_URL}/auth/callback`, state, true));
};