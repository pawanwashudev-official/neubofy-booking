/**
 * Disconnect Google Calendar integration
 */

import { redirect, type RequestHandler } from '@sveltejs/kit';
import { getCurrentUser } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	const env = event.platform?.env;
	if (!env) {
		throw redirect(302, '/dashboard?error=server_error');
	}

	const userId = await getCurrentUser(event);
	if (!userId) {
		throw redirect(302, '/auth/login');
	}

	// Reset Google calendar connected flag
	const db = env.DB;
	await db
		.prepare('UPDATE users SET google_calendar_connected = 0 WHERE id = ?')
		.bind(userId)
		.run();

	throw redirect(302, '/dashboard/calendars?success=google_disconnected');
};
