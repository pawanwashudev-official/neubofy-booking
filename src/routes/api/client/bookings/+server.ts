/**
 * Client Portal Self-Service API
 * Fetches bookings belonging strictly to the client (by Firebase UID or verified attendee email).
 */

import { json, error, type RequestEvent } from '@sveltejs/kit';

export const POST = async (event: RequestEvent) => {
	const env = event.platform?.env;
	if (!env?.DB) {
		throw error(500, 'Database not available');
	}

	try {
		const body = await event.request.json() as {
			clientFirebaseUid?: string;
			email?: string;
		};

		const clientFirebaseUid = body.clientFirebaseUid?.trim();
		const email = body.email?.trim().toLowerCase();

		if (!clientFirebaseUid && !email) {
			throw error(400, 'Client identification (UID or verified email) is required.');
		}

		const db = env.DB;

		let queryStr = `
			SELECT b.id, b.client_firebase_uid, b.attendee_name, b.attendee_email,
			       b.start_time, b.end_time, b.duration_minutes, b.status, b.price_amount,
			       b.coupon_code, b.is_paid, b.meeting_url, b.created_at,
			       et.name as event_name, et.slug as event_slug, et.description as event_description,
			       u.name as expert_name, u.email as expert_email, u.profile_image as expert_image,
			       u.role_title as expert_role
			FROM bookings b
			JOIN event_types et ON et.id = b.event_type_id
			JOIN users u ON u.id = b.user_id
			WHERE 1=0
		`;

		const params: any[] = [];

		if (clientFirebaseUid) {
			queryStr += ` OR b.client_firebase_uid = ?`;
			params.push(clientFirebaseUid);
		}

		if (email) {
			queryStr += ` OR LOWER(b.attendee_email) = ?`;
			params.push(email);
		}

		queryStr += ` ORDER BY b.start_time DESC`;

		const bookingsResult = await db.prepare(queryStr).bind(...params).all<any>();
		const bookings = bookingsResult.results || [];

		return json({
			success: true,
			bookings: bookings.map((b) => ({
				id: b.id,
				eventName: b.event_name,
				eventSlug: b.event_slug,
				eventDescription: b.event_description,
				expertName: b.expert_name,
				expertEmail: b.expert_email,
				expertImage: b.expert_image,
				expertRole: b.expert_role,
				startTime: b.start_time,
				endTime: b.end_time,
				durationMinutes: b.duration_minutes,
				status: b.status,
				priceAmount: b.price_amount,
				couponCode: b.coupon_code,
				isPaid: b.is_paid === 1,
				meetingUrl: b.meeting_url,
				createdAt: b.created_at
			}))
		});
	} catch (err: any) {
		console.error('[client:bookings] Failed to fetch client bookings:', err);
		if (err?.status) throw err;
		throw error(500, err?.message || 'Failed to retrieve bookings.');
	}
};
