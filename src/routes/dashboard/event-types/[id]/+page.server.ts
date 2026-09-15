/**
 * Edit Consultation Service Server Load & Action
 * Allows updating service details, Live vs Paused status, and assigning specialists
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
			reason: 'You need Administrator privileges to edit consultation services.',
			permissionNeeded: 'Super Admin or Administrator Role',
			currentRole: auth.role === 'member' ? 'Member Expert' : auth.role
		});
	}

	const db = event.platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const eventTypeId = event.params.id;

	// 1. Fetch consultation service
	const eventType = await db
		.prepare(
			`SELECT id, user_id, name, slug, duration_minutes as duration, durations_json,
			        description, category, is_active, price_inr, cover_image
			 FROM event_types
			 WHERE id = ? OR slug = ?`
		)
		.bind(eventTypeId, eventTypeId)
		.first<{
			id: string;
			user_id: string | null;
			name: string;
			slug: string;
			duration: number;
			durations_json: string | null;
			description: string | null;
			category: string | null;
			is_active: number;
			price_inr: number | null;
			cover_image: string | null;
		}>();

	if (!eventType) {
		throw error(404, 'Consultation service not found');
	}

	// 2. Fetch all organization team members
	const membersResult = await db
		.prepare(
			`SELECT u.id, u.name, u.email, u.role_title, u.profile_image, COALESCE(om.role, 'member') as role
			 FROM users u
			 LEFT JOIN organization_members om ON om.user_id = u.id AND om.is_active = 1
			 WHERE u.is_active = 1
			 ORDER BY CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.name ASC`
		)
		.all();

	// 3. Fetch currently assigned expert IDs
	const assignmentsResult = await db
		.prepare('SELECT user_id FROM event_type_members WHERE event_type_id = ? AND is_active = 1')
		.bind(eventType.id)
		.all();

	let assignedExpertIds = ((assignmentsResult.results as any[]) || []).map((a) => a.user_id);

	// If no junction records yet, check if legacy creator user exists
	if (assignedExpertIds.length === 0 && eventType.user_id) {
		assignedExpertIds = [eventType.user_id];
	}

	let parsedDurations: number[] = [30];
	try {
		parsedDurations = eventType.durations_json ? JSON.parse(eventType.durations_json) : [eventType.duration || 30];
	} catch {
		parsedDurations = [eventType.duration || 30];
	}

	return {
		eventType: {
			...eventType,
			durations: parsedDurations
		},
		teamMembers: (membersResult.results as any[]) || [],
		assignedExpertIds
	};
};

export const actions: Actions = {
	default: async (event) => {
		const auth = await getAuthContext(event);
		if (!auth) throw redirect(302, '/auth/login');
		if (!isOrganizationAdmin(auth.role)) {
			return fail(403, { error: 'Administrator privileges required.' });
		}

		const db = event.platform?.env?.DB;
		if (!db) return fail(500, { error: 'Database connection not available.' });

		const eventTypeId = event.params.id;

		// Verify existence
		const existing = await db
			.prepare('SELECT id, name FROM event_types WHERE id = ? OR slug = ?')
			.bind(eventTypeId, eventTypeId)
			.first<{ id: string; name: string }>();

		if (!existing) {
			return fail(404, { error: 'Consultation service not found.' });
		}

		const formData = await event.request.formData();
		const name = (formData.get('name') || '').toString().trim();
		const slug = (formData.get('slug') || '').toString().trim().toLowerCase();
		const category = (formData.get('category') || 'Consultation').toString().trim();
		const description = (formData.get('description') || '').toString().trim();
		const status = formData.get('status') || 'live'; // 'live' or 'paused'
		const isActive = status === 'live' ? 1 : 0;
		const durationsRaw = formData.getAll('durations');
		const assignedExperts = formData.getAll('assigned_experts').map((id) => id.toString());
		const pricingType = formData.get('pricing_type') || 'complimentary';
		const isFreeOnly = pricingType === 'complimentary' ? 1 : 0;
		const priceInr = isFreeOnly ? 0 : Math.max(0, parseInt((formData.get('price_inr') || '0').toString(), 10) || 0);

		if (!name || !slug) {
			return fail(400, { error: 'Service name and URL slug are required.' });
		}

		if (!/^[a-z0-9-]+$/.test(slug)) {
			return fail(400, { error: 'Slug can only contain lowercase alphanumeric characters and hyphens.' });
		}

		let durations = durationsRaw.map((d) => parseInt(d.toString(), 10)).filter((d) => !isNaN(d) && d > 0);
		if (durations.length === 0) {
			durations = [30];
		}
		const primaryDuration = durations[0];

		// Check if slug taken by another service
		const slugConflict = await db
			.prepare('SELECT id FROM event_types WHERE slug = ? AND id != ?')
			.bind(slug, existing.id)
			.first();

		if (slugConflict) {
			return fail(400, { error: 'A consultation service with this slug already exists.' });
		}

		try {
			// 1. Update event type
			await db
				.prepare(
					`UPDATE event_types
					 SET name = ?, slug = ?, duration_minutes = ?, durations_json = ?,
					     category = ?, description = ?, is_active = ?, price_inr = ?
					 WHERE id = ?`
				)
				.bind(
					name,
					slug,
					primaryDuration,
					JSON.stringify(durations),
					category,
					description,
					isActive,
					priceInr,
					existing.id
				)
				.run();

			// 2. Re-sync assigned experts in event_type_members
			await db
				.prepare('DELETE FROM event_type_members WHERE event_type_id = ?')
				.bind(existing.id)
				.run();

			if (assignedExperts.length > 0) {
				const batchQueries = assignedExperts.map((userId) =>
					db
						.prepare(
							`INSERT OR IGNORE INTO event_type_members (event_type_id, user_id, is_active, created_at)
							 VALUES (?, ?, 1, CURRENT_TIMESTAMP)`
						)
						.bind(existing.id, userId)
				);
				await db.batch(batchQueries);
			}

			throw redirect(302, '/dashboard/event-types');
		} catch (err: any) {
			if (err?.status === 302 || err?.location) throw err;
			console.error('Error updating consultation service:', err);
			return fail(500, { error: err.message || 'Failed to update consultation service.' });
		}
	}
};
