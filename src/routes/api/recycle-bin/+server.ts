/**
 * Recycle Bin API Endpoint (Admin / Owner Only)
 * Handles auditing, restoration, and permanent purging of soft-deleted records.
 */

import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getAuthContext, isOrganizationAdmin } from '$lib/server/auth';

export const GET = async (event: RequestEvent) => {
	const auth = await getAuthContext(event);
	if (!auth) throw error(401, 'Unauthorized');
	if (!isOrganizationAdmin(auth.role)) {
		throw error(403, 'Administrator permission required to view the Recycle Bin');
	}

	const db = event.platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const orgId = auth.organizationId || 'org_neubofy_main';

	try {
		const [deletedBookings, deletedEventTypes, deletedCoupons] = await Promise.all([
			db.prepare(
				`SELECT b.id, b.attendee_name, b.attendee_email, b.start_time, b.status,
				        b.is_paid, b.price_amount, b.deleted_at, b.deleted_by,
				        et.name as event_type_name, u.name as expert_name
				 FROM bookings b
				 LEFT JOIN event_types et ON b.event_type_id = et.id
				 LEFT JOIN users u ON b.user_id = u.id
				 WHERE b.organization_id = ? AND b.is_deleted = 1
				 ORDER BY b.deleted_at DESC`
			).bind(orgId).all(),

			db.prepare(
				`SELECT id, name, slug, duration_minutes, price_inr, is_free_only, deleted_at
				 FROM event_types
				 WHERE (organization_id = ? OR organization_id = 'org_neubofy_main') AND is_deleted = 1
				 ORDER BY deleted_at DESC`
			).bind(orgId).all(),

			db.prepare(
				`SELECT id, code, discount_type, discount_value, used_count, deleted_at
				 FROM coupons
				 WHERE (organization_id = ? OR organization_id = 'org_neubofy_main') AND is_deleted = 1
				 ORDER BY deleted_at DESC`
			).bind(orgId).all()
		]);

		return json({
			success: true,
			bookings: deletedBookings.results || [],
			eventTypes: deletedEventTypes.results || [],
			coupons: deletedCoupons.results || []
		});
	} catch (err: any) {
		console.error('Error fetching Recycle Bin items:', err);
		throw error(500, 'Failed to fetch Recycle Bin items');
	}
};

export const POST = async (event: RequestEvent) => {
	const auth = await getAuthContext(event);
	if (!auth) throw error(401, 'Unauthorized');
	if (!isOrganizationAdmin(auth.role)) {
		throw error(403, 'Administrator permission required for Recycle Bin operations');
	}

	const db = event.platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const { action, type, id } = (await event.request.json().catch(() => ({}))) as {
		action?: 'restore' | 'purge';
		type?: 'booking' | 'event_type' | 'coupon';
		id?: string;
	};

	if (!action || !type || !id) {
		throw error(400, 'action, type, and id are required parameters');
	}

	const orgId = auth.organizationId || 'org_neubofy_main';

	if (action === 'restore') {
		if (type === 'booking') {
			await db
				.prepare('UPDATE bookings SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL WHERE id = ? AND organization_id = ?')
				.bind(id, orgId)
				.run();
			return json({ success: true, message: 'Booking successfully restored.' });
		}

		if (type === 'event_type') {
			await db
				.prepare('UPDATE event_types SET is_deleted = 0, deleted_at = NULL, is_active = 1 WHERE id = ? AND (organization_id = ? OR organization_id = "org_neubofy_main")')
				.bind(id, orgId)
				.run();
			return json({ success: true, message: 'Consultation service restored.' });
		}

		if (type === 'coupon') {
			await db
				.prepare('UPDATE coupons SET is_deleted = 0, deleted_at = NULL, is_active = 1 WHERE id = ? AND (organization_id = ? OR organization_id = "org_neubofy_main")')
				.bind(id, orgId)
				.run();
			return json({ success: true, message: 'Coupon code restored.' });
		}
	}

	if (action === 'purge') {
		if (type === 'booking') {
			await db.batch([
				db.prepare('DELETE FROM reschedule_proposals WHERE booking_id = ?').bind(id),
				db.prepare('DELETE FROM scheduled_emails WHERE booking_id = ?').bind(id),
				db.prepare('DELETE FROM bookings WHERE id = ? AND organization_id = ?').bind(id, orgId)
			]);
			return json({ success: true, message: 'Booking permanently purged.' });
		}

		if (type === 'event_type') {
			await db.batch([
				db.prepare('DELETE FROM event_type_members WHERE event_type_id = ?').bind(id),
				db.prepare('DELETE FROM event_types WHERE id = ? AND (organization_id = ? OR organization_id = "org_neubofy_main")').bind(id, orgId)
			]);
			return json({ success: true, message: 'Consultation service permanently purged.' });
		}

		if (type === 'coupon') {
			await db
				.prepare('DELETE FROM coupons WHERE id = ? AND (organization_id = ? OR organization_id = "org_neubofy_main")')
				.bind(id, orgId)
				.run();
			return json({ success: true, message: 'Coupon permanently purged.' });
		}
	}

	throw error(400, 'Invalid action or type');
};
