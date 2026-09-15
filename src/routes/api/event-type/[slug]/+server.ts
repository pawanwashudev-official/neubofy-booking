/**
 * Event Type API endpoint (single-user)
 * Returns event type data by slug
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthContext, isOrganizationAdmin } from '$lib/server/auth';

export const GET: RequestHandler = async ({ params, platform }) => {
	const env = platform?.env;
	if (!env) {
		throw error(500, 'Platform env not available');
	}

	const slug = params.slug;
	const db = env.DB;

	try {
		// Get the first (and only) user
		const user = await db
			.prepare('SELECT id, slug, name, profile_image, brand_color, settings, outlook_refresh_token FROM users LIMIT 1')
			.first<{ id: string; slug: string; name: string; profile_image: string | null; brand_color: string | null; settings: string | null; outlook_refresh_token: string | null }>();

		if (!user) {
			throw error(404, 'User not found');
		}

		// Get event type
		const eventType = await db
			.prepare(
				'SELECT id, name, slug, duration_minutes as duration, description, is_active, cover_image, invite_calendar FROM event_types WHERE user_id = ? AND slug = ? AND is_active = 1 AND COALESCE(is_deleted, 0) = 0'
			)
			.bind(user.id, slug)
			.first<{
				id: string;
				name: string;
				slug: string;
				duration: number;
				description: string;
				is_active: number;
				cover_image: string | null;
				invite_calendar: string | null;
			}>();

		if (!eventType) {
			throw error(404, 'Event type not found or inactive');
		}

		// Parse user settings
		let userSettings: { timeFormat?: string; defaultInviteCalendar?: string } = {};
		try {
			userSettings = user.settings ? JSON.parse(user.settings) : {};
		} catch {}

		// Determine effective invite calendar: use event type override if set, otherwise use global settings
		// Fall back to Google if Outlook not available
		const outlookConnected = !!user.outlook_refresh_token;
		const outlookConfigured = !!(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET);
		let effectiveInviteCalendar = eventType.invite_calendar || userSettings.defaultInviteCalendar || 'google';
		if (effectiveInviteCalendar === 'outlook' && (!outlookConnected || !outlookConfigured)) {
			effectiveInviteCalendar = 'google';
		}

		return json({
			slug: eventType.slug,
			eventType: {
				...eventType,
				invite_calendar: effectiveInviteCalendar // Return the effective calendar, not the stored one
			},
			user: {
				name: user.name,
				profileImage: user.profile_image,
				brandColor: user.brand_color || '#3b82f6',
				timeFormat: userSettings.timeFormat || '12h'
			}
		});
	} catch (err: any) {
		console.error('Event type API error:', err);
		if (err?.status) throw err;
		throw error(500, 'Failed to fetch event type');
	}
};

export const DELETE: RequestHandler = async (event) => {
	const auth = await getAuthContext(event);
	if (!auth) throw error(401, 'Unauthorized');
	const db = event.platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const identifier = event.params.slug;
	const eventType = await db
		.prepare('SELECT id, user_id, name FROM event_types WHERE (slug = ? OR id = ?) AND (organization_id = ? OR organization_id IS NULL OR ? = "org_neubofy_main")')
		.bind(identifier, identifier, auth.organizationId || 'org_neubofy_main', auth.organizationId || 'org_neubofy_main')
		.first<{ id: string; user_id: string; name: string }>();

	if (!eventType) throw error(404, 'Consultation service not found');
	if (eventType.user_id !== auth.userId && !isOrganizationAdmin(auth.role)) {
		throw error(403, 'You do not have permission to delete this service');
	}

	await db.batch([
		db.prepare('UPDATE event_types SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, is_active = 0 WHERE id = ?').bind(eventType.id),
		db.prepare('UPDATE event_type_members SET is_active = 0 WHERE event_type_id = ?').bind(eventType.id)
	]);

	return json({ success: true, id: eventType.id, message: 'Consultation service moved to Recycle Bin.' });
};
