/**
 * Create New Consultation Service Server Load & Action
 * Includes specialist assignment and Live vs Paused status
 */

import { redirect, fail, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getAuthContext, isOrganizationAdmin } from '$lib/server/auth';
import { validateLength, validateFields, MAX_LENGTHS } from '$lib/server/validation';

export const load: PageServerLoad = async (event) => {
	const auth = await getAuthContext(event);
	if (!auth) throw redirect(302, '/auth/login');
	if (!isOrganizationAdmin(auth.role)) {
		throw error(403, {
			message: 'Administrator Permission Required',
			reason: 'You need Administrator privileges to create consultation services.',
			permissionNeeded: 'Super Admin or Administrator Role',
			currentRole: auth.role === 'member' ? 'Member Expert' : auth.role
		});
	}

	const db = event.platform?.env?.DB;
	if (!db) {
		return { teamMembers: [] };
	}

	// Fetch all active team members/specialists for assignment
	const membersResult = await db
		.prepare(
			`SELECT u.id, u.name, u.email, u.role_title, u.profile_image, COALESCE(om.role, 'member') as role
			 FROM users u
			 LEFT JOIN organization_members om ON om.user_id = u.id AND om.is_active = 1
			 WHERE u.is_active = 1
			 ORDER BY CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.name ASC`
		)
		.all();

	return {
		teamMembers: (membersResult.results as any[]) || []
	};
};

export const actions: Actions = {
	default: async (event) => {
		const auth = await getAuthContext(event);
		if (!auth) throw redirect(302, '/auth/login');
		if (!isOrganizationAdmin(auth.role)) {
			return fail(403, { error: 'Administrator privileges required to create consultation services.' });
		}

		const db = event.platform?.env?.DB;
		if (!db) return fail(500, { error: 'Database connection not available' });

		const formData = await event.request.formData();
		const name = (formData.get('name') || '').toString().trim();
		const slug = (formData.get('slug') || '').toString().trim().toLowerCase();
		const category = (formData.get('category') || 'Consultation').toString().trim();
		const description = (formData.get('description') || '').toString().trim();
		const status = formData.get('status') || 'live'; // 'live' or 'paused'
		const isActive = status === 'live' ? 1 : 0;
		const durationsRaw = formData.getAll('durations'); // e.g. ['30', '60']
		const pricingType = formData.get('pricing_type') || 'complimentary'; // 'complimentary' or 'paid'
		const isFreeOnly = pricingType === 'complimentary' ? 1 : 0;
		const priceInr = isFreeOnly ? 0 : Math.max(0, parseInt((formData.get('price_inr') || '0').toString(), 10) || 0);
		const assignedExpertsRaw = formData.getAll('assigned_experts');
		let assignedExperts = assignedExpertsRaw.map((e) => e.toString().trim()).filter(Boolean);
		if (assignedExperts.length === 0) {
			assignedExperts = [auth.userId];
		}

		if (!name || !slug) {
			return fail(400, { error: 'Service name and URL slug are required.' });
		}

		// Validate slug format
		if (!/^[a-z0-9-]+$/.test(slug)) {
			return fail(400, { error: 'Slug can only contain lowercase alphanumeric characters and hyphens.' });
		}

		// Parse durations
		let durations = durationsRaw.map((d) => parseInt(d.toString(), 10)).filter((d) => !isNaN(d) && d > 0);
		if (durations.length === 0) {
			durations = [30];
		}
		const primaryDuration = durations[0];

		// Check if slug exists in organization
		const existing = await db
			.prepare('SELECT id FROM event_types WHERE slug = ?')
			.bind(slug)
			.first();

		if (existing) {
			return fail(400, { error: 'A consultation service with this slug already exists. Please choose a unique slug.' });
		}

		const eventTypeId = crypto.randomUUID();
		const orgId = auth.organizationId || 'org_neubofy_main';

		try {
			// 1. Insert consultation service
			await db
				.prepare(
					`INSERT INTO event_types (
						id, organization_id, user_id, name, slug, duration_minutes,
						durations_json, category, description, is_active, price_inr,
						location_type, created_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'google_meet', CURRENT_TIMESTAMP)`
				)
				.bind(
					eventTypeId,
					orgId,
					auth.userId,
					name,
					slug,
					primaryDuration,
					JSON.stringify(durations),
					category,
					description,
					isActive,
					priceInr
				)
				.run();

			// 2. Insert assigned specialists into event_type_members
			if (assignedExperts.length > 0) {
				const batchQueries = assignedExperts.map((expertUserId) =>
					db
						.prepare(
							`INSERT OR IGNORE INTO event_type_members (event_type_id, user_id, is_active, created_at)
							 VALUES (?, ?, 1, CURRENT_TIMESTAMP)`
						)
						.bind(eventTypeId, expertUserId)
				);
				await db.batch(batchQueries);
			}

			throw redirect(302, '/dashboard/event-types');
		} catch (err: any) {
			if (err?.status === 302 || err?.location) throw err;
			console.error('Error creating consultation service:', err);
			return fail(500, { error: err.message || 'Failed to create consultation service.' });
		}
	}
};
