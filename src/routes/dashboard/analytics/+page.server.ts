/**
 * Dashboard Analytics Server Load
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
			reason: 'Analytics and team workload metrics are restricted to Organization Administrators and Super Admins.',
			permissionNeeded: 'Administrator or Super Admin Role',
			currentRole: auth.role === 'member' ? 'Member Expert' : auth.role
		});
	}

	const db = event.platform?.env?.DB;
	if (!db) {
		return {
			kpis: { total: 0, upcoming: 0, completed: 0, canceled: 0, totalHours: 0, completionRate: 100 },
			expertStats: [],
			popularServices: [],
			recentBookings: []
		};
	}

	const queryParams: any[] = [];

	try {
		// 1. KPIs
		const stats = await db
			.prepare(
				`SELECT 
					count(*) as total,
					sum(CASE WHEN b.status = 'confirmed' AND b.start_time > datetime('now') THEN 1 ELSE 0 END) as upcoming,
					sum(CASE WHEN b.status = 'confirmed' AND b.start_time <= datetime('now') THEN 1 ELSE 0 END) as completed,
					sum(CASE WHEN b.status = 'canceled' THEN 1 ELSE 0 END) as canceled,
					sum(b.duration_minutes) as total_minutes
				 FROM bookings b
				 WHERE b.organization_id = ? OR b.organization_id = 'org_neubofy_main'`
			)
			.bind(auth.organizationId || 'org_neubofy_main')
			.first<{
				total: number;
				upcoming: number;
				completed: number;
				canceled: number;
				total_minutes: number | null;
			}>();

		const total = stats?.total || 0;
		const completed = stats?.completed || 0;
		const upcoming = stats?.upcoming || 0;
		const canceled = stats?.canceled || 0;
		const totalMinutes = stats?.total_minutes || 0;
		const completionRate = total > 0 ? Math.round((completed / (completed + canceled || 1)) * 100) : 100;

		// 2. Expert Stats
		const experts = await db
			.prepare(
				`SELECT 
					u.id, u.name, u.email, u.role_title, u.profile_image,
					count(b.id) as total,
					sum(CASE WHEN b.status = 'confirmed' AND b.start_time > datetime('now') THEN 1 ELSE 0 END) as upcoming,
					sum(CASE WHEN b.status = 'confirmed' AND b.start_time <= datetime('now') THEN 1 ELSE 0 END) as completed
				 FROM users u
				 JOIN organization_members om ON om.user_id = u.id
				 LEFT JOIN bookings b ON b.user_id = u.id
				 WHERE om.is_active = 1 AND (om.organization_id = ? OR om.organization_id = 'org_neubofy_main')
				 GROUP BY u.id
				 ORDER BY total DESC`
			)
			.bind(auth.organizationId || 'org_neubofy_main')
			.all();
		const expertStats = (experts.results as any[]) || [];

		// 3. Popular Services
		const popularServices = await db
			.prepare(
				`SELECT 
					et.id, et.name, et.category, et.slug,
					count(b.id) as booking_count
				 FROM event_types et
				 LEFT JOIN bookings b ON b.event_type_id = et.id
				 WHERE et.is_active = 1 AND (et.organization_id = ? OR et.organization_id = 'org_neubofy_main')
				 GROUP BY et.id
				 ORDER BY booking_count DESC
				 LIMIT 6`
			)
			.bind(auth.organizationId || 'org_neubofy_main')
			.all();

		// 4. Recent Bookings
		const recentBookings = await db
			.prepare(
				`SELECT 
					b.id, b.attendee_name, b.attendee_email, b.attendee_phone, b.goal, b.start_time, b.end_time,
					b.duration_minutes, b.status, b.meeting_url,
					et.name as service_name, et.category as service_category,
					u.name as expert_name, u.role_title as expert_role
				 FROM bookings b
				 JOIN event_types et ON et.id = b.event_type_id
				 JOIN users u ON u.id = b.user_id
				 WHERE b.organization_id = ? OR b.organization_id = 'org_neubofy_main'
				 ORDER BY b.created_at DESC
				 LIMIT 15`
			)
			.bind(auth.organizationId || 'org_neubofy_main')
			.all();

		return {
			kpis: {
				total,
				upcoming,
				completed,
				canceled,
				totalHours: Math.round((totalMinutes / 60) * 10) / 10,
				completionRate
			},
			expertStats,
			popularServices: popularServices.results || [],
			recentBookings: recentBookings.results || []
		};
	} catch (err: any) {
		console.error('Analytics page server error:', err);
		return {
			kpis: { total: 0, upcoming: 0, completed: 0, canceled: 0, totalHours: 0, completionRate: 100 },
			expertStats: [],
			popularServices: [],
			recentBookings: []
		};
	}
};
