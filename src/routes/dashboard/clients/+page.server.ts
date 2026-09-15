/**
 * Dashboard Clients Directory - Server Load
 */

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthContext, isOrganizationAdmin } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	const auth = await getAuthContext(event);
	if (!auth) {
		throw error(401, 'Unauthorized');
	}

	const env = event.platform?.env;
	if (!env?.DB) {
		return { clients: [], totalClients: 0, totalBookings: 0 };
	}

	const db = env.DB;
	const isAdmin = isOrganizationAdmin(auth.role);
	const workspaceMode = event.url.searchParams.get('workspace') || (isAdmin ? 'org' : 'personal');

	try {
		let queryStr = `
			SELECT b.id, b.client_firebase_uid, b.attendee_name, b.attendee_email, b.attendee_phone,
			       b.start_time, b.end_time, b.duration_minutes, b.status, b.price_amount, b.discount_amount,
			       b.coupon_code, b.is_paid, b.meeting_url, b.goal, b.reason, b.expectations, b.attendee_notes,
			       b.created_at,
			       et.name as event_name, et.slug as event_slug,
			       u.id as expert_id, u.name as expert_name, u.email as expert_email
			FROM bookings b
			JOIN event_types et ON et.id = b.event_type_id
			JOIN users u ON u.id = b.user_id
			WHERE b.organization_id = ?
		`;

		const params: any[] = [auth.organizationId];

		if (workspaceMode === 'personal' || !isAdmin) {
			queryStr += ` AND b.user_id = ?`;
			params.push(auth.userId);
		}

		queryStr += ` ORDER BY b.start_time DESC`;

		const bookingsResult = await db.prepare(queryStr).bind(...params).all<any>();
		const bookings = bookingsResult.results || [];

		const clientsMap = new Map<string, any>();

		for (const b of bookings) {
			const clientKey = (b.attendee_email || '').toLowerCase();
			if (!clientKey) continue;

			if (!clientsMap.has(clientKey)) {
				clientsMap.set(clientKey, {
					email: b.attendee_email,
					name: b.attendee_name,
					phone: b.attendee_phone,
					clientFirebaseUid: b.client_firebase_uid || null,
					totalSessions: 0,
					confirmedCount: 0,
					canceledCount: 0,
					totalSpent: 0,
					lastSessionDate: b.start_time,
					sessions: []
				});
			}

			const client = clientsMap.get(clientKey);
			client.totalSessions += 1;
			if (b.status === 'confirmed') client.confirmedCount += 1;
			if (b.status === 'canceled') client.canceledCount += 1;
			client.totalSpent += b.price_amount || 0;

			if (!client.phone && b.attendee_phone) client.phone = b.attendee_phone;
			if (!client.clientFirebaseUid && b.client_firebase_uid) client.clientFirebaseUid = b.client_firebase_uid;

			client.sessions.push({
				id: b.id,
				eventName: b.event_name,
				eventSlug: b.event_slug,
				expertId: b.expert_id,
				expertName: b.expert_name,
				expertEmail: b.expert_email,
				startTime: b.start_time,
				endTime: b.end_time,
				durationMinutes: b.duration_minutes,
				status: b.status,
				priceAmount: b.price_amount,
				discountAmount: b.discount_amount,
				couponCode: b.coupon_code,
				isPaid: b.is_paid === 1,
				meetingUrl: b.meeting_url,
				goal: b.goal,
				reason: b.reason,
				expectations: b.expectations,
				notes: b.attendee_notes,
				createdAt: b.created_at
			});
		}

		const clients = Array.from(clientsMap.values()).sort((a, b) => {
			return new Date(b.lastSessionDate).getTime() - new Date(a.lastSessionDate).getTime();
		});

		return {
			clients,
			totalClients: clients.length,
			totalBookings: bookings.length,
			workspaceMode
		};
	} catch (err) {
		console.error('[dashboard:clients:load] Error loading clients:', err);
		return { clients: [], totalClients: 0, totalBookings: 0, workspaceMode };
	}
};
