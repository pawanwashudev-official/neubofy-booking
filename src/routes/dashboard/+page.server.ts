/**
 * Dashboard page - shows event types and recent bookings
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthContext, isOrganizationAdmin } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	const auth = await getAuthContext(event);

	if (!auth) {
		throw redirect(302, '/auth/login');
	}

	const db = event.platform?.env?.DB;
	if (!db) {
		throw new Error('Database not available');
	}

	// Get user info
	const user = await db
		.prepare('SELECT id, email, name, slug, profile_image, brand_color, settings, contact_email, public_title, public_bio, public_specialties, public_contact_email, public_mobile, public_social_handle, public_profile_enabled FROM users WHERE id = ?')
		.bind(auth.userId)
		.first();

	// Get event types
	const eventTypes = await db
		.prepare(
			`SELECT id, name, slug, duration_minutes as duration, description, is_active
			FROM event_types
			WHERE organization_id = ? AND (? = 1 OR EXISTS (
				SELECT 1 FROM event_type_hosts h
				WHERE h.event_type_id = event_types.id AND h.user_id = ? AND h.is_active = 1
			))
			ORDER BY name ASC`
		)
		.bind(auth.organizationId, isOrganizationAdmin(auth.role) ? 1 : 0, auth.userId)
		.all<{
			id: string;
			name: string;
			slug: string;
			duration: number;
			description: string;
			is_active: number;
		}>();

	// Get organization bookings so completed and canceled records can be cleaned up.
	const recentBookings = await db
		.prepare(
			`SELECT b.id, b.start_time, b.end_time, b.attendee_name, b.attendee_email,
				b.status, b.created_at, b.attendee_notes, b.canceled_by, b.cancellation_reason,
				b.event_type_id, et.name as event_type_name, et.slug as event_type_slug, et.duration_minutes
			FROM bookings b
			JOIN event_types et ON b.event_type_id = et.id
			WHERE b.organization_id = ? AND (? = 1 OR b.user_id = ?)
			ORDER BY b.start_time DESC
			LIMIT 50`
		)
		.bind(auth.organizationId, isOrganizationAdmin(auth.role) ? 1 : 0, auth.userId)
		.all<{
			id: string;
			start_time: string;
			end_time: string;
			attendee_name: string;
			attendee_email: string;
			status: string;
			created_at: string;
			event_type_name: string;
			event_type_slug: string;
			event_type_id: string;
			duration_minutes: number;
			attendee_notes: string | null;
			canceled_by: string | null;
			cancellation_reason: string | null;
		}>();

	const appUrl = event.platform?.env?.APP_URL || '';

	return {
		user,
		organization: await db
			.prepare('SELECT id, name, slug, profile_image, brand_color, timezone, contact_email, reply_to_email, settings FROM organizations WHERE id = ?')
			.bind(auth.organizationId)
			.first(),
		role: auth.role,
		canManageOrganization: isOrganizationAdmin(auth.role),
		eventTypes: eventTypes.results,
		recentBookings: recentBookings.results,
		appUrl
	};
};
