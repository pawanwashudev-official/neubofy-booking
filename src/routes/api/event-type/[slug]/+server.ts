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
				'SELECT id, name, slug, duration_minutes as duration, description, is_active, cover_image, invite_calendar FROM event_types WHERE user_id = ? AND slug = ? AND is_active = 1'
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

	const eventType = await db
		.prepare('SELECT id, user_id, name FROM event_types WHERE slug = ? AND organization_id = ?')
		.bind(event.params.slug, auth.organizationId)
		.first<{ id: string; user_id: string; name: string }>();
	if (!eventType) throw error(404, 'Event type not found');
	if (eventType.user_id !== auth.userId && !isOrganizationAdmin(auth.role)) {
		throw error(403, 'You do not have permission to delete this event type');
	}

	const body = await event.request.json().catch(() => ({})) as { confirmation?: string };
	if (body.confirmation !== eventType.name) throw error(400, 'Type the event name to confirm deletion');
	const activeBooking = await db
		.prepare(`SELECT id FROM bookings WHERE event_type_id = ? AND status = 'confirmed' AND end_time > CURRENT_TIMESTAMP LIMIT 1`)
		.bind(eventType.id)
		.first();
	if (activeBooking) throw error(409, 'Cancel or complete active bookings before deleting this event type');

	await db.batch([
		db.prepare('DELETE FROM reschedule_proposals WHERE booking_id IN (SELECT id FROM bookings WHERE event_type_id = ?)').bind(eventType.id),
		db.prepare('DELETE FROM scheduled_emails WHERE booking_id IN (SELECT id FROM bookings WHERE event_type_id = ?)').bind(eventType.id),
		db.prepare('DELETE FROM bookings WHERE event_type_id = ?').bind(eventType.id),
		db.prepare('DELETE FROM availability_rules WHERE event_type_id = ?').bind(eventType.id),
		db.prepare('DELETE FROM event_types WHERE id = ? AND organization_id = ?').bind(eventType.id, auth.organizationId)
	]);

	return json({ success: true });
};
