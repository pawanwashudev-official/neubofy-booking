/**
 * Google Calendar Sync Settings Server Loader
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getCurrentUser } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	const userId = await getCurrentUser(event);

	if (!userId) {
		throw redirect(302, '/auth/login');
	}

	const db = event.platform?.env?.DB;
	if (!db) {
		return { user: null };
	}

	// Query user calendar connection status
	const user = await db
		.prepare('SELECT id, google_refresh_token, settings FROM users WHERE id = ?')
		.bind(userId)
		.first<{ id: string; google_refresh_token: string | null; settings: string | null }>();

	let userSettings: { selectedGoogleCalendars?: string[] } = {};
	try {
		userSettings = user?.settings ? JSON.parse(user.settings) : {};
	} catch {
		userSettings = {};
	}

	return {
		user: user ? {
			googleConnected: !!user.google_refresh_token,
			selectedGoogleCalendars: userSettings.selectedGoogleCalendars
		} : null
	};
};
