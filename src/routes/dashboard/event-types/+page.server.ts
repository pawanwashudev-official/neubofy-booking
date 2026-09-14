/**
 * Consultation Services List Page Server Load
 */

import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthContext, isOrganizationAdmin } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	const auth = await getAuthContext(event);
	if (!auth) throw redirect(302, '/auth/login');
	if (!isOrganizationAdmin(auth.role)) {
		throw error(403, {
			message: 'Administrator Permission Required',
			reason: 'You need Administrator privileges to configure organization consultation services and manage specialist assignments.',
			permissionNeeded: 'Super Admin or Organization Administrator Role',
			currentRole: auth.role === 'member' ? 'Member Expert' : auth.role
		});
	}

	const db = event.platform?.env?.DB;
	if (!db) {
		return { eventTypes: [] };
	}

	const eventTypes = await db
		.prepare(
			`SELECT et.id, et.user_id, et.organization_id, et.name, et.slug, et.duration_minutes, et.description,
			        et.category, et.is_active, et.is_free_only, et.color, et.durations_json,
			        count(b.id) as booking_count
			 FROM event_types et
			 LEFT JOIN bookings b ON b.event_type_id = et.id
			 WHERE et.organization_id = ? OR et.organization_id IS NULL OR et.organization_id = 'org_neubofy_main' OR et.user_id = ?
			 GROUP BY et.id
			 ORDER BY et.created_at ASC`
		)
		.bind(auth.organizationId || 'org_neubofy_main', auth.userId)
		.all();

	// Fetch detailed assigned specialists per service
	const assignmentsResult = await db
		.prepare(
			`SELECT etm.event_type_id, u.id as user_id, u.name, u.role_title, u.profile_image
			 FROM event_type_members etm
			 JOIN users u ON u.id = etm.user_id
			 WHERE etm.is_active = 1
			 ORDER BY u.name ASC`
		)
		.all();

	const assignments = (assignmentsResult.results as any[]) || [];

	// Fetch all active users to support mapping legacy services
	const allUsersResult = await db
		.prepare('SELECT id, name, role_title, profile_image FROM users WHERE is_active = 1')
		.all();
	const allUsers = (allUsersResult.results as any[]) || [];
	const userMap = new Map(allUsers.map((u) => [u.id, u]));

	const enriched = (eventTypes.results as any[]).map((et) => {
		let assignedExperts = assignments
			.filter((a) => a.event_type_id === et.id)
			.map((a) => ({
				id: a.user_id,
				name: a.name,
				role_title: a.role_title,
				profile_image: a.profile_image
			}));

		// If no junction records yet, check if legacy creator user exists
		if (assignedExperts.length === 0 && et.user_id && userMap.has(et.user_id)) {
			const u = userMap.get(et.user_id)!;
			assignedExperts = [
				{
					id: u.id,
					name: u.name,
					role_title: u.role_title,
					profile_image: u.profile_image
				}
			];
		}

		let parsedDurations: number[] = [30];
		try {
			parsedDurations = et.durations_json ? JSON.parse(et.durations_json) : [et.duration_minutes || 30];
		} catch {}

		return {
			...et,
			durations: parsedDurations,
			assigned_experts: assignedExperts,
			assigned_experts_count: assignedExperts.length
		};
	});

	return {
		eventTypes: enriched
	};
};
