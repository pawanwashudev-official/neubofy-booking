/**
 * Workspace Mode Switcher API Endpoint
 * Persists user preference for Personal vs Organization workspace.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthContext, isOrganizationAdmin } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	const auth = await getAuthContext(event);
	if (!auth) {
		throw error(401, 'Not authenticated');
	}

	try {
		const body = (await event.request.json()) as { mode?: 'personal' | 'org' };
		let mode = body.mode === 'personal' ? 'personal' : 'org';

		// Non-admin members can only be in personal mode
		if (!isOrganizationAdmin(auth.role)) {
			mode = 'personal';
		}

		event.cookies.set('neubofy_workspace_mode', mode, {
			path: '/',
			httpOnly: false,
			sameSite: 'lax',
			maxAge: 365 * 24 * 60 * 60
		});

		return json({ success: true, mode });
	} catch (err: any) {
		console.error('Workspace mode update error:', err);
		throw error(500, 'Failed to update workspace mode');
	}
};
