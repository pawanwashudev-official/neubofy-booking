/**
 * Analytics API endpoint
 * Aggregates consultation metrics, completion rates, expert workloads, and service popularity
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthContext, isOrganizationAdmin } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
	const { platform } = event;
	const env = platform?.env;
	if (!env) {
		throw error(500, 'Platform env not available');
	}

	const auth = await getAuthContext(event);
	if (!auth) {
		throw error(401, 'Unauthorized');
	}

	const db = env.DB;
	const isAdmin = isOrganizationAdmin(auth.role);

	try {
		// Base booking query filter
		const userFilter = isAdmin ? '' : 'WHERE b.user_id = ?';
		const queryParams = isAdmin ? [] : [auth.userId];

		// 1. Overall KPIs
		const stats = await db
			.prepare(
				`SELECT 
					count(*) as total,
					sum(CASE WHEN b.status = 'confirmed' AND b.start_time > datetime('now') THEN 1 ELSE 0 END) as upcoming,
					sum(CASE WHEN b.status = 'confirmed' AND b.start_time <= datetime('now') THEN 1 ELSE 0 END) as completed,
					sum(CASE WHEN b.status = 'canceled' THEN 1 ELSE 0 END) as canceled,
					sum(b.duration_minutes) as total_minutes
				 FROM bookings b
				 ${userFilter}`
			)
			.bind(...queryParams)
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

		// 2. Expert workload distribution (for Admins)
		let expertStats: Array<{
			id: string;
			name: string;
			email: string;
			role_title: string | null;
			profile_image: string | null;
			total: number;
			upcoming: number;
			completed: number;
		}> = [];

		if (isAdmin) {
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
					 WHERE om.is_active = 1
					 GROUP BY u.id
					 ORDER BY total DESC`
				)
				.all();
			expertStats = (experts.results as any[]) || [];
		}

		// 3. Consultation service popularity
		const popularServices = await db
			.prepare(
				`SELECT 
					et.id, et.name, et.category, et.slug,
					count(b.id) as booking_count
				 FROM event_types et
				 LEFT JOIN bookings b ON b.event_type_id = et.id ${isAdmin ? '' : 'AND b.user_id = ?'}
				 WHERE et.is_active = 1
				 GROUP BY et.id
				 ORDER BY booking_count DESC
				 LIMIT 6`
			)
			.bind(...queryParams)
			.all();

		// 4. Recent consultations activity
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
				 ${userFilter}
				 ORDER BY b.created_at DESC
				 LIMIT 12`
			)
			.bind(...queryParams)
			.all();

		return json({
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
		});
	} catch (err: any) {
		console.error('Analytics API error:', err);
		throw error(500, 'Failed to fetch analytics data');
	}
};
