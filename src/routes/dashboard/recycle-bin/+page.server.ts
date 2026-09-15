/**
 * Recycle Bin Server Load & Actions (Admin / Owner Only)
 */

import { redirect, fail, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getAuthContext, isOrganizationAdmin } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	const auth = await getAuthContext(event);
	if (!auth) throw redirect(302, '/auth/login');
	if (!isOrganizationAdmin(auth.role)) {
		throw error(403, {
			message: 'Administrator Permission Required',
			reason: 'Only organization administrators and owners can access the Recycle Bin.',
			permissionNeeded: 'Super Admin or Administrator Role',
			currentRole: auth.role === 'member' ? 'Member Expert' : auth.role
		});
	}

	const db = event.platform?.env?.DB;
	if (!db) {
		return { bookings: [], eventTypes: [], coupons: [] };
	}

	const orgId = auth.organizationId || 'org_neubofy_main';

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

	return {
		bookings: (deletedBookings.results as any[]) || [],
		eventTypes: (deletedEventTypes.results as any[]) || [],
		coupons: (deletedCoupons.results as any[]) || []
	};
};

export const actions: Actions = {
	restore: async (event) => {
		const auth = await getAuthContext(event);
		if (!auth) throw redirect(302, '/auth/login');
		if (!isOrganizationAdmin(auth.role)) {
			return fail(403, { error: 'Administrator permission required.' });
		}

		const db = event.platform?.env?.DB;
		if (!db) return fail(500, { error: 'Database not available' });

		const formData = await event.request.formData();
		const type = formData.get('type')?.toString();
		const id = formData.get('id')?.toString();

		if (!type || !id) {
			return fail(400, { error: 'Item type and ID are required.' });
		}

		const orgId = auth.organizationId || 'org_neubofy_main';

		if (type === 'booking') {
			await db
				.prepare('UPDATE bookings SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL WHERE id = ? AND organization_id = ?')
				.bind(id, orgId)
				.run();
		} else if (type === 'event_type') {
			await db
				.prepare('UPDATE event_types SET is_deleted = 0, deleted_at = NULL, is_active = 1 WHERE id = ? AND (organization_id = ? OR organization_id = "org_neubofy_main")')
				.bind(id, orgId)
				.run();
		} else if (type === 'coupon') {
			await db
				.prepare('UPDATE coupons SET is_deleted = 0, deleted_at = NULL, is_active = 1 WHERE id = ? AND (organization_id = ? OR organization_id = "org_neubofy_main")')
				.bind(id, orgId)
				.run();
		}

		return { success: true, message: 'Item successfully restored.' };
	},

	purge: async (event) => {
		const auth = await getAuthContext(event);
		if (!auth) throw redirect(302, '/auth/login');
		if (!isOrganizationAdmin(auth.role)) {
			return fail(403, { error: 'Administrator permission required.' });
		}

		const db = event.platform?.env?.DB;
		if (!db) return fail(500, { error: 'Database not available' });

		const formData = await event.request.formData();
		const type = formData.get('type')?.toString();
		const id = formData.get('id')?.toString();

		if (!type || !id) {
			return fail(400, { error: 'Item type and ID are required.' });
		}

		const orgId = auth.organizationId || 'org_neubofy_main';

		if (type === 'booking') {
			await db.batch([
				db.prepare('DELETE FROM reschedule_proposals WHERE booking_id = ?').bind(id),
				db.prepare('DELETE FROM scheduled_emails WHERE booking_id = ?').bind(id),
				db.prepare('DELETE FROM bookings WHERE id = ? AND organization_id = ?').bind(id, orgId)
			]);
		} else if (type === 'event_type') {
			await db.batch([
				db.prepare('DELETE FROM event_type_members WHERE event_type_id = ?').bind(id),
				db.prepare('DELETE FROM event_types WHERE id = ? AND (organization_id = ? OR organization_id = "org_neubofy_main")').bind(id, orgId)
			]);
		} else if (type === 'coupon') {
			await db
				.prepare('DELETE FROM coupons WHERE id = ? AND (organization_id = ? OR organization_id = "org_neubofy_main")')
				.bind(id, orgId)
				.run();
		}

		return { success: true, message: 'Item permanently purged.' };
	}
};
