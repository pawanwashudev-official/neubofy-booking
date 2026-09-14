/**
 * Booking page for a specific organization event type.
 */

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, platform }) => {
	const env = platform?.env;
	if (!env) {
		throw error(500, 'Platform env not available');
	}

	const db = env.DB;

	try {
		const organization = await db
			.prepare('SELECT id, slug, name, profile_image, brand_color FROM organizations ORDER BY created_at LIMIT 1')
			.first<{ id: string; slug: string; name: string; profile_image: string | null; brand_color: string | null }>();

		if (!organization) throw error(404, 'Organization not found');

		const eventType = await db
			.prepare(
				`SELECT et.id, et.slug, et.name, et.duration_minutes as duration, et.description,
					et.is_active, et.cover_image, et.invite_calendar, et.user_id as host_user_id,
					u.name as host_name, u.email as host_email, u.settings as host_settings,
					u.outlook_refresh_token
				 FROM event_types et
				 LEFT JOIN users u ON u.id = et.user_id
				 WHERE (et.organization_id = ? OR et.organization_id IS NULL OR et.organization_id = 'org_neubofy_main')
				   AND et.slug = ?
				   AND COALESCE(et.is_active, 1) = 1`
			)
			.bind(organization.id, params.slug)
			.first<{
				id: string;
				slug: string;
				name: string;
				duration: number;
				description: string | null;
				is_active: number;
				cover_image: string | null;
				invite_calendar: string | null;
				host_user_id: string | null;
				host_name: string | null;
				host_email: string | null;
				host_settings: string | null;
				outlook_refresh_token: string | null;
			}>();

		if (!eventType) throw error(404, 'Event type not found or inactive');

		// If no direct host_user_id, resolve from assigned event_type_members
		if (!eventType.host_user_id) {
			const member = await db
				.prepare(
					`SELECT u.id as host_user_id, u.name as host_name, u.email as host_email,
					        u.settings as host_settings, u.outlook_refresh_token
					 FROM event_type_members etm
					 JOIN users u ON u.id = etm.user_id
					 WHERE etm.event_type_id = ? AND etm.is_active = 1
					 LIMIT 1`
				)
				.bind(eventType.id)
				.first<{ host_user_id: string; host_name: string; host_email: string; host_settings: string | null; outlook_refresh_token: string | null }>();

			if (member) {
				Object.assign(eventType, member);
			}
		}

		let hostSettings: { timeFormat?: string; defaultInviteCalendar?: string } = {};
		try {
			hostSettings = eventType.host_settings ? JSON.parse(eventType.host_settings) : {};
		} catch {
			hostSettings = {};
		}

		let effectiveInviteCalendar = eventType.invite_calendar || hostSettings.defaultInviteCalendar || 'google';
		const outlookConfigured = !!(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET);
		if (effectiveInviteCalendar === 'outlook' && (!eventType.outlook_refresh_token || !outlookConfigured)) {
			effectiveInviteCalendar = 'google';
		}

		return {
			slug: eventType.slug,
			eventType: { ...eventType, invite_calendar: effectiveInviteCalendar },
			user: {
				name: organization.name,
				profileImage: organization.profile_image,
				brandColor: organization.brand_color || '#3b82f6',
				timeFormat: hostSettings.timeFormat || '12h'
			},
			host: { name: eventType.host_name, email: eventType.host_email }
		};
	} catch (err: any) {
		console.error('Booking page load error:', err);
		if (err?.status) throw err;
		throw error(500, 'Failed to load booking page');
	}
};
