/**
 * Dashboard page server load
 * Loads user info, consultation events, and recent appointments with full intake info
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

	// 1. Get user info
	const user = await db
		.prepare(
			`SELECT id, email, name, slug, profile_image, brand_color, settings, contact_email,
			        role_title, bio, phone, session_pricing, is_free_consultation, google_refresh_token
			 FROM users WHERE id = ?`
		)
		.bind(auth.userId)
		.first<{
			id: string;
			email: string;
			name: string;
			slug: string;
			profile_image: string | null;
			brand_color: string | null;
			settings: string | null;
			contact_email: string | null;
			role_title: string | null;
			bio: string | null;
			phone: string | null;
			session_pricing: string | null;
			is_free_consultation: number | null;
			google_refresh_token: string | null;
		}>();

	const isAdmin = isOrganizationAdmin(auth.role);

	// 2. Get consultation services
	const eventTypes = await db
		.prepare(
			`SELECT id, name, slug, duration_minutes as duration, description, is_active, category
			 FROM event_types
			 WHERE organization_id = ? AND (? = 1 OR user_id = ?)
			 ORDER BY created_at ASC`
		)
		.bind(auth.organizationId, isAdmin ? 1 : 0, auth.userId)
		.all<{
			id: string;
			name: string;
			slug: string;
			duration: number;
			description: string;
			is_active: number;
			category: string | null;
		}>();

	// 3. Get bookings with intake responses and Google Meet links
	const recentBookings = await db
		.prepare(
			`SELECT b.id, b.start_time, b.end_time, b.duration_minutes, b.attendee_name, b.attendee_email,
			        b.attendee_phone, b.goal, b.reason, b.expectations, b.attendee_notes, b.meeting_url,
			        b.status, b.created_at, b.canceled_by, b.cancellation_reason,
			        b.event_type_id, et.name as event_type_name, et.slug as event_type_slug, et.category as service_category,
			        u.name as expert_name, u.role_title as expert_role
			 FROM bookings b
			 JOIN event_types et ON b.event_type_id = et.id
			 JOIN users u ON b.user_id = u.id
			 WHERE b.organization_id = ? AND (? = 1 OR b.user_id = ?)
			 ORDER BY b.start_time DESC
			 LIMIT 50`
		)
		.bind(auth.organizationId, isAdmin ? 1 : 0, auth.userId)
		.all();

	const organization = await db
		.prepare('SELECT id, name, slug, profile_image, brand_color, timezone, contact_email, reply_to_email, settings FROM organizations WHERE id = ?')
		.bind(auth.organizationId)
		.first();

	return {
		user,
		organization,
		role: auth.role,
		canManageOrganization: isAdmin,
		eventTypes: eventTypes.results || [],
		recentBookings: (recentBookings.results as any[]) || [],
		appUrl: event.platform?.env?.APP_URL || 'https://booking.neubofy.in'
	};
};
