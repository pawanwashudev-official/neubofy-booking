import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getAuthContext, isOrganizationAdmin } from '$lib/server/auth';

export const DELETE = async (event: RequestEvent) => {
	const auth = await getAuthContext(event);
	if (!auth) throw error(401, 'Unauthorized');
	const db = event.platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const body = await event.request.json().catch(() => ({})) as { bookingId?: string; confirmation?: string };
	if (!body.bookingId) throw error(400, 'Booking ID is required');
	const booking = await db.prepare(
		`SELECT id, user_id, attendee_name, status, end_time
		 FROM bookings WHERE id = ? AND organization_id = ?`
	).bind(body.bookingId, auth.organizationId).first<{ id: string; user_id: string; attendee_name: string; status: string; end_time: string }>();
	if (!booking) throw error(404, 'Booking not found');
	if (booking.user_id !== auth.userId && !isOrganizationAdmin(auth.role)) {
		throw error(403, 'You do not have permission to delete this booking');
	}
	if (booking.status === 'confirmed' && new Date(booking.end_time).getTime() > Date.now()) {
		throw error(409, 'Future confirmed bookings must be cancelled before deletion');
	}
	if (body.confirmation !== booking.attendee_name) throw error(400, 'Type the attendee name to confirm deletion');

	await db.batch([
		db.prepare('DELETE FROM reschedule_proposals WHERE booking_id = ?').bind(booking.id),
		db.prepare('DELETE FROM bookings WHERE id = ? AND organization_id = ?').bind(booking.id, auth.organizationId)
	]);

	return json({ success: true });
};
