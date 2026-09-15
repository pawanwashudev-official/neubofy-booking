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

	// 1. Get user info
	let user: any = null;
	try {
		user = await db
			.prepare(
				`SELECT id, email, name, slug, profile_image, brand_color, settings, contact_email,
				        role_title, bio, phone, session_pricing, is_free_consultation, google_refresh_token
				 FROM users WHERE id = ? AND COALESCE(is_deleted, 0) = 0`
			)
			.bind(auth.userId)
			.first();
	} catch (err) {
		console.error('Failed to load user in dashboard:', err);
	}

	// 2. Get consultation services (clean single query)
	let eventTypesList: any[] = [];
	try {
		const res = await db
			.prepare(
				`SELECT id, name, slug, duration_minutes as duration, description, is_active, category, is_free_only, price_inr
				 FROM event_types
				 WHERE organization_id = ? AND (? = 1 OR user_id = ?) AND COALESCE(is_deleted, 0) = 0
				 ORDER BY created_at ASC`
			)
			.bind(auth.organizationId, (isAdmin && workspaceMode === 'org') ? 1 : 0, auth.userId)
			.all();
		eventTypesList = res.results || [];
	} catch (e) {
		console.error('Failed to load event types in dashboard:', e);
		eventTypesList = [];
	}

	// 3. Get bookings with pagination
	const filterByPersonalOnly = workspaceMode === 'personal' || !isAdmin;
	const page = Math.max(1, parseInt(event.url.searchParams.get('page') || '1', 10));
	const pageSize = Math.min(100, Math.max(10, parseInt(event.url.searchParams.get('pageSize') || '25', 10)));
	const offset = (page - 1) * pageSize;

	let recentBookingsList: any[] = [];
	let totalBookings = 0;

	try {
		// Total count query
		const countQuery = `
			SELECT count(*) as total
			FROM bookings b
			JOIN event_types et ON b.event_type_id = et.id
			WHERE b.organization_id = ? AND COALESCE(b.is_deleted, 0) = 0 ${filterByPersonalOnly ? 'AND b.user_id = ?' : ''}
		`;
		const countRes = await db
			.prepare(countQuery)
			.bind(...(filterByPersonalOnly ? [auth.organizationId, auth.userId] : [auth.organizationId]))
			.first<{ total: number }>();
		totalBookings = countRes?.total || 0;

		// Paginated bookings query
		const bookingsQuery = `
			SELECT b.id, b.start_time, b.end_time, b.duration_minutes, b.attendee_name, b.attendee_email,
			        b.attendee_phone, b.goal, b.reason, b.expectations, b.attendee_notes, b.meeting_url,
			        b.status, b.created_at, b.canceled_by, b.cancellation_reason,
			        b.price_amount as final_price, b.discount_amount, b.coupon_code, b.is_paid,
			        b.event_type_id, et.name as event_type_name, et.slug as event_type_slug, et.category as service_category,
			        u.name as expert_name, u.role_title as expert_role
			 FROM bookings b
			 JOIN event_types et ON b.event_type_id = et.id
			 JOIN users u ON b.user_id = u.id
			 WHERE b.organization_id = ? AND COALESCE(b.is_deleted, 0) = 0 ${filterByPersonalOnly ? 'AND b.user_id = ?' : ''}
			 ORDER BY b.start_time DESC
			 LIMIT ? OFFSET ?
		`;
		const res = await db
			.prepare(bookingsQuery)
			.bind(...(filterByPersonalOnly ? [auth.organizationId, auth.userId, pageSize, offset] : [auth.organizationId, pageSize, offset]))
			.all();
		recentBookingsList = res.results || [];
	} catch (err) {
		console.error('Failed to load recent bookings in dashboard:', err);
		recentBookingsList = [];
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
		pagination: {
			page,
			pageSize,
			totalCount: totalBookings,
			totalPages: Math.ceil(totalBookings / pageSize)
		},
		appUrl: event.platform?.env?.APP_URL || 'https://booking.neubofy.in'
	};
};
