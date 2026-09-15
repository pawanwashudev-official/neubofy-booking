/**
 * SvelteKit Global Server Hooks
 * Resolves session on incoming requests and populates event.locals.user
 */

import type { Handle } from '@sveltejs/kit';
import { getCurrentUser } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	try {
		const userId = await getCurrentUser(event);
		if (userId && event.platform?.env?.DB) {
			const user = await event.platform.env.DB
				.prepare('SELECT id, email, name, is_active FROM users WHERE id = ? AND COALESCE(is_deleted, 0) = 0')
				.bind(userId)
				.first<{ id: string; email: string; name: string; is_active: number }>();

			if (user && user.is_active === 1) {
				event.locals.user = {
					id: user.id,
					email: user.email,
					name: user.name
				};
			}
		}
	} catch (err) {
		console.error('Global hooks session resolution error:', err);
	}

	return resolve(event);
};
