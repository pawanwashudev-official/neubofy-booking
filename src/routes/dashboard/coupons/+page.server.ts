/**
 * Coupons Management Server Load & Actions (Admin/Owner Only)
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
			reason: 'You need Administrator privileges to manage promotional coupons and consultation pricing discounts.',
			permissionNeeded: 'Super Admin or Administrator Role',
			currentRole: auth.role === 'member' ? 'Member Expert' : auth.role
		});
	}

	const db = event.platform?.env?.DB;
	if (!db) {
		return { coupons: [], eventTypes: [] };
	}

	const couponsResult = await db
		.prepare(
			`SELECT c.id, c.code, c.discount_type, c.discount_value, c.max_uses, c.used_count,
			        c.is_active, c.expires_at, c.created_at, et.name as event_type_name
			 FROM coupons c
			 LEFT JOIN event_types et ON et.id = c.event_type_id
			 WHERE (c.organization_id = ? OR c.organization_id = 'org_neubofy_main')
			   AND COALESCE(c.is_deleted, 0) = 0
			 ORDER BY c.created_at DESC`
		)
		.bind(auth.organizationId || 'org_neubofy_main')
		.all();

	const eventTypesResult = await db
		.prepare('SELECT id, name, slug FROM event_types WHERE is_active = 1 AND COALESCE(is_deleted, 0) = 0 ORDER BY name ASC')
		.all();

	return {
		coupons: (couponsResult.results as any[]) || [],
		eventTypes: (eventTypesResult.results as any[]) || []
	};
};

export const actions: Actions = {
	create: async (event) => {
		const auth = await getAuthContext(event);
		if (!auth) throw redirect(302, '/auth/login');
		if (!isOrganizationAdmin(auth.role)) {
			return fail(403, { error: 'Administrator permission required.' });
		}

		const db = event.platform?.env?.DB;
		if (!db) return fail(500, { error: 'Database not available' });

		const formData = await event.request.formData();
		const code = (formData.get('code') || '').toString().trim().toUpperCase();
		const discountType = formData.get('discount_type') === 'fixed' ? 'fixed' : 'percentage';
		const discountValue = parseInt((formData.get('discount_value') || '0').toString(), 10);
		const maxUsesRaw = formData.get('max_uses');
		const maxUses = maxUsesRaw ? parseInt(maxUsesRaw.toString(), 10) : null;
		const eventTypeId = (formData.get('event_type_id') || '').toString().trim() || null;
		const expiresAt = (formData.get('expires_at') || '').toString().trim() || null;

		if (!code || !/^[A-Z0-9_-]+$/.test(code)) {
			return fail(400, { error: 'Coupon code is required and must contain alphanumeric characters or hyphens.' });
		}

		if (isNaN(discountValue) || discountValue <= 0) {
			return fail(400, { error: 'Please specify a valid positive discount amount.' });
		}

		if (discountType === 'percentage' && discountValue > 100) {
			return fail(400, { error: 'Percentage discount cannot exceed 100%.' });
		}

		// Check duplicate
		const existing = await db
			.prepare('SELECT id FROM coupons WHERE UPPER(code) = ?')
			.bind(code)
			.first();

		if (existing) {
			return fail(400, { error: `Coupon code '${code}' already exists.` });
		}

		const couponId = crypto.randomUUID();
		const orgId = auth.organizationId || 'org_neubofy_main';

		try {
			await db
				.prepare(
					`INSERT INTO coupons (
						id, organization_id, code, discount_type, discount_value,
						event_type_id, max_uses, used_count, is_active, expires_at, created_by, created_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, CURRENT_TIMESTAMP)`
				)
				.bind(
					couponId,
					orgId,
					code,
					discountType,
					discountValue,
					eventTypeId,
					maxUses,
					expiresAt,
					auth.userId
				)
				.run();

			return { success: true };
		} catch (err: any) {
			console.error('Create coupon error:', err);
			return fail(500, { error: err.message || 'Failed to create coupon code.' });
		}
	},

	toggle: async (event) => {
		const auth = await getAuthContext(event);
		if (!auth) throw redirect(302, '/auth/login');
		if (!isOrganizationAdmin(auth.role)) {
			return fail(403, { error: 'Administrator permission required.' });
		}

		const db = event.platform?.env?.DB;
		if (!db) return fail(500, { error: 'Database not available' });

		const formData = await event.request.formData();
		const couponId = (formData.get('id') || '').toString();
		const currentActive = formData.get('is_active') === '1' ? 1 : 0;
		const newActive = currentActive === 1 ? 0 : 1;

		await db
			.prepare('UPDATE coupons SET is_active = ? WHERE id = ?')
			.bind(newActive, couponId)
			.run();

		return { success: true };
	},

	delete: async (event) => {
		const auth = await getAuthContext(event);
		if (!auth) throw redirect(302, '/auth/login');
		if (!isOrganizationAdmin(auth.role)) {
			return fail(403, { error: 'Administrator permission required.' });
		}

		const db = event.platform?.env?.DB;
		if (!db) return fail(500, { error: 'Database not available' });

		const formData = await event.request.formData();
		const couponId = (formData.get('id') || '').toString();

		await db
			.prepare('UPDATE coupons SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, is_active = 0 WHERE id = ?')
			.bind(couponId)
			.run();

		return { success: true, message: 'Coupon moved to Recycle Bin.' };
	}
};
