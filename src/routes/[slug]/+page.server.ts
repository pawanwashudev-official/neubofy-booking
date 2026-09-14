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
				 JOIN users u ON u.id = et.user_id
				 WHERE et.organization_id = ? AND et.slug = ? AND et.is_active = 1`
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
				host_user_id: string;
				host_name: string;
				host_email: string;
				host_settings: string | null;
				outlook_refresh_token: string | null;
			}>();

		if (!eventType) throw error(404, 'Event type not found');

		const experts = await db.prepare(
			`SELECT u.id, u.name, u.profile_image, u.public_title, u.public_bio,
				u.public_specialties, u.public_contact_email, u.public_mobile, u.public_social_handle,
				u.public_profile_enabled
			 FROM event_type_hosts h
			 JOIN organization_members om ON om.organization_id = h.organization_id AND om.user_id = h.user_id AND om.is_active = 1
			 JOIN users u ON u.id = h.user_id AND u.is_active = 1
			 WHERE h.event_type_id = ? AND h.is_active = 1
			 ORDER BY u.name`
		).bind(eventType.id).all<{
			id: string;
			name: string;
			profile_image: string | null;
			public_title: string | null;
			public_bio: string | null;
			public_specialties: string | null;
			public_contact_email: string | null;
			public_mobile: string | null;
			public_social_handle: string | null;
			public_profile_enabled: number | null;
		}>();

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
			experts: experts.results.map(expert => ({
				id: expert.id,
				name: expert.name,
				profileImage: expert.profile_image,
				title: expert.public_profile_enabled ? expert.public_title : null,
				bio: expert.public_profile_enabled ? expert.public_bio : null,
				specialties: expert.public_profile_enabled ? expert.public_specialties : null,
				contactEmail: expert.public_profile_enabled ? expert.public_contact_email : null,
				mobile: expert.public_profile_enabled ? expert.public_mobile : null,
				socialHandle: expert.public_profile_enabled ? expert.public_social_handle : null
			})),
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
