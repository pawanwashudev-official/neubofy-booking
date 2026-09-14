/**
 * Dashboard page server load
 * Loads user info, consultation events, and recent appointments with full intake info
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthContext, isOrganizationAdmin, getWorkspaceMode } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	const auth = await getAuthContext(event);
	if (!auth) {
		throw redirect(302, '/auth/login');
	}

	const db = event.platform?.env?.DB;
	if (!db) {
		throw new Error('Database not available');
	}

	const isAdmin = isOrganizationAdmin(auth.role);
	const workspaceMode = getWorkspaceMode(event, auth.role);

	// 1. Get user info with safe fallback
	let user: any = null;
	try {
		user = await db
			.prepare(
				`SELECT id, email, name, slug, profile_image, brand_color, settings, contact_email,
				        role_title, bio, phone, session_pricing, is_free_consultation, google_refresh_token
				 FROM users WHERE id = ?`
			)
			.bind(auth.userId)
			.first();
	} catch (e) {
		try {
			user = await db
				.prepare('SELECT id, email, name, slug, profile_image, brand_color, settings, contact_email, google_refresh_token FROM users WHERE id = ?')
				.bind(auth.userId)
				.first();
		} catch (err) {
			console.error('Failed to load user in dashboard:', err);
		}
	}

	// 2. Get consultation services with safe fallback
	let eventTypesList: any[] = [];
	try {
		const res = await db
			.prepare(
				`SELECT id, name, slug, duration_minutes as duration, description, is_active, category, is_free_only, price_inr
				 FROM event_types
				 WHERE organization_id = ? AND (? = 1 OR user_id = ?)
				 ORDER BY created_at ASC`
			)
			.bind(auth.organizationId, (isAdmin && workspaceMode === 'org') ? 1 : 0, auth.userId)
			.all();
		eventTypesList = res.results || [];
	} catch {
		try {
			const res = await db
				.prepare(
					`SELECT id, name, slug, duration_minutes as duration, description, is_active, category
					 FROM event_types
					 WHERE organization_id = ? AND (? = 1 OR user_id = ?)
					 ORDER BY created_at ASC`
				)
				.bind(auth.organizationId, (isAdmin && workspaceMode === 'org') ? 1 : 0, auth.userId)
				.all();
			eventTypesList = (res.results || []).map((et: any) => ({ ...et, is_free_only: 1, price_inr: 0 }));
		} catch {
			try {
				const res = await db
					.prepare('SELECT id, name, slug, duration_minutes as duration, description, is_active FROM event_types WHERE ? = 1 OR user_id = ?')
					.bind((isAdmin && workspaceMode === 'org') ? 1 : 0, auth.userId)
					.all();
				eventTypesList = (res.results || []).map((et: any) => ({ ...et, is_free_only: 1, price_inr: 0, category: 'Consultation' }));
			} catch (e) {
				console.error('Failed to load event types in dashboard:', e);
			}
		}
	}

	// 3. Get bookings with intake responses and Google Meet links
	// Strictly filter by auth.userId when in personal mode or when not an admin
	const filterByPersonalOnly = workspaceMode === 'personal' || !isAdmin;
	let recentBookingsList: any[] = [];

	try {
		const res = await db
			.prepare(
				`SELECT b.id, b.start_time, b.end_time, b.duration_minutes, b.attendee_name, b.attendee_email,
				        b.attendee_phone, b.goal, b.reason, b.expectations, b.attendee_notes, b.meeting_url,
				        b.status, b.created_at, b.canceled_by, b.cancellation_reason,
				        b.price_amount as final_price, b.discount_amount, b.coupon_code, b.is_paid,
				        b.event_type_id, et.name as event_type_name, et.slug as event_type_slug, et.category as service_category,
				        u.name as expert_name, u.role_title as expert_role
				 FROM bookings b
				 JOIN event_types et ON b.event_type_id = et.id
				 JOIN users u ON b.user_id = u.id
				 WHERE b.organization_id = ? ${filterByPersonalOnly ? 'AND b.user_id = ?' : ''}
				 ORDER BY b.start_time DESC
				 LIMIT 50`
			)
			.bind(...(filterByPersonalOnly ? [auth.organizationId, auth.userId] : [auth.organizationId]))
			.all();
		recentBookingsList = res.results || [];
	} catch (err1) {
		// Fallback for schema without coupon_code / discount_amount / price_amount / intake columns
		try {
			const res = await db
				.prepare(
					`SELECT b.id, b.start_time, b.end_time, b.attendee_name, b.attendee_email,
					        b.attendee_notes, b.meeting_url, b.status, b.created_at, b.canceled_by, b.cancellation_reason,
					        b.event_type_id, et.name as event_type_name, et.slug as event_type_slug,
					        u.name as expert_name
					 FROM bookings b
					 JOIN event_types et ON b.event_type_id = et.id
					 JOIN users u ON b.user_id = u.id
					 WHERE b.organization_id = ? ${filterByPersonalOnly ? 'AND b.user_id = ?' : ''}
					 ORDER BY b.start_time DESC
					 LIMIT 50`
				)
				.bind(...(filterByPersonalOnly ? [auth.organizationId, auth.userId] : [auth.organizationId]))
				.all();
			recentBookingsList = (res.results || []).map((b: any) => ({
				...b,
				final_price: 0,
				duration_minutes: 30,
				service_category: 'Consultation',
				expert_role: 'Technology Consultant'
			}));
		} catch (err2) {
			console.error('Failed to load recent bookings in dashboard:', err2);
		}
	}

	let organization: any = null;
	try {
		organization = await db
			.prepare('SELECT id, name, slug, profile_image, brand_color, timezone, contact_email, reply_to_email, settings FROM organizations WHERE id = ?')
			.bind(auth.organizationId)
			.first();
	} catch (e) {
		console.error('Failed to load organization in dashboard:', e);
	}

	return {
		user,
		organization: organization || {
			id: auth.organizationId,
			name: 'Neubofy™',
			slug: 'neubofy',
			brand_color: '#3b82f6',
			timezone: 'Asia/Kolkata',
			profile_image: 'https://neubofy.in/neubofylogo.png'
		},
		role: auth.role,
		canManageOrganization: isAdmin,
		workspaceMode,
		eventTypes: eventTypesList,
		recentBookings: recentBookingsList,
		appUrl: event.platform?.env?.APP_URL || 'https://booking.neubofy.in'
	};
};
