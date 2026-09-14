/**
 * Consultation Services List Page Server Load
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthContext, isOrganizationAdmin } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	const auth = await getAuthContext(event);
	if (!auth) throw redirect(302, '/auth/login');
	if (!isOrganizationAdmin(auth.role)) throw redirect(302, '/dashboard');

	const db = event.platform?.env?.DB;
	if (!db) {
		return { eventTypes: [] };
	}

	const eventTypes = await db
		.prepare(
			`SELECT et.id, et.name, et.slug, et.duration_minutes, et.description,
			        et.category, et.is_active, et.is_free_only, et.color, et.durations_json,
			        count(b.id) as booking_count
			 FROM event_types et
			 LEFT JOIN bookings b ON b.event_type_id = et.id
			 WHERE et.organization_id = ?
			 GROUP BY et.id
			 ORDER BY et.created_at ASC`
		)
		.bind(auth.organizationId)
		.all();

	// Also get count of assigned members per event
	const assignments = await db
		.prepare('SELECT event_type_id, count(user_id) as member_count FROM event_type_members WHERE is_active = 1 GROUP BY event_type_id')
		.all();

	const memberCountMap = new Map();
	for (const a of (assignments.results as any[]) || []) {
		memberCountMap.set(a.event_type_id, a.member_count);
	}

	const enriched = (eventTypes.results as any[]).map((et) => ({
		...et,
		assigned_experts_count: memberCountMap.get(et.id) || 0
	}));

	return {
		eventTypes: enriched
	};
};
