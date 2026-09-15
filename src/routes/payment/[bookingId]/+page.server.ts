import { error, redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { finalizeConfirmedBooking } from '$lib/server/booking-service';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const bookingId = params.bookingId;

	const booking = await db
		.prepare(
			`SELECT b.id, b.start_time, b.end_time, b.duration_minutes,
			        b.attendee_name, b.attendee_email, b.attendee_phone,
			        b.price_amount, b.discount_amount, b.coupon_code, b.is_paid, b.meeting_url,
			        e.name as event_name, e.description as event_description,
			        u.name as host_name, u.role_title as host_role
			 FROM bookings b
			 JOIN event_types e ON b.event_type_id = e.id
			 JOIN users u ON b.user_id = u.id
			 WHERE b.id = ? AND COALESCE(b.is_deleted, 0) = 0`
		)
		.bind(bookingId)
		.first<{
			id: string;
			start_time: string;
			end_time: string;
			duration_minutes: number;
			attendee_name: string;
			attendee_email: string;
			attendee_phone: string | null;
			price_amount: number;
			discount_amount: number;
			coupon_code: string | null;
			is_paid: number;
			meeting_url: string | null;
			event_name: string;
			event_description: string | null;
			host_name: string;
			host_role: string | null;
		}>();

	if (!booking) {
		throw error(404, 'Booking consultation not found');
	}

	const upiId = 'neubofy@pnb';
	const amount = booking.price_amount || 0;
	// Standard UPI payment URI format
	const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent('Neubofy')}&am=${amount}&tn=${encodeURIComponent(`Consultation-${booking.id.slice(0, 8)}`)}`;

	return {
		booking,
		upiId,
		upiUri,
		alreadyPaid: Boolean(booking.is_paid)
	};
};

export const actions: Actions = {
	confirmPayment: async ({ params, platform }) => {
		const db = platform?.env?.DB;
		const env = platform?.env;
		if (!db || !env) {
			return fail(500, { error: 'Service unavailable' });
		}

		const bookingId = params.bookingId;

		try {
			// Fetch booking
			const booking = await db
				.prepare('SELECT id, is_paid FROM bookings WHERE id = ? AND COALESCE(is_deleted, 0) = 0')
				.bind(bookingId)
				.first<{ id: string; is_paid: number }>();

			if (!booking) {
				return fail(404, { error: 'Booking not found' });
			}

			// Mark paid immediately upon client confirmation
			await db
				.prepare('UPDATE bookings SET is_paid = 1 WHERE id = ?')
				.bind(bookingId)
				.run();

			// Provision calendar event & send confirmation emails
			await finalizeConfirmedBooking(db, env, bookingId);

			throw redirect(303, `/payment/${bookingId}?success=true`);
		} catch (err: any) {
			if (err?.status === 303) throw err;
			console.error('Payment confirmation error:', err);
			return fail(500, { error: err?.message || 'Failed to confirm payment' });
		}
	}
};
