/**
 * Root Public Booking Portal Load Function
 * Loads real consultation services from the database. No fake templates.
 */

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	const db = platform?.env?.DB;

	if (!db) {
		return {
			organization: {
				name: 'Neubofy™',
				slug: 'neubofy',
				profile_image: 'https://neubofy.in/neubofylogo.png',
				brand_color: '#3b82f6'
			},
			eventTypes: [],
			allExperts: []
		};
	}

	try {
		// 1. Fetch organization
		let organization = await db
			.prepare('SELECT id, name, slug, profile_image, brand_color, contact_email FROM organizations ORDER BY created_at LIMIT 1')
			.first<{
				id: string;
				name: string;
				slug: string;
				profile_image: string | null;
				brand_color: string | null;
				contact_email: string | null;
			}>();

		if (!organization) {
			organization = {
				id: 'org_neubofy_main',
				name: 'Neubofy™',
				slug: 'neubofy',
				profile_image: 'https://neubofy.in/neubofylogo.png',
				brand_color: '#3b82f6',
				contact_email: 'contact@neubofy.in'
			};
		}

		// 2. Fetch only real active consultation events from DB (no fake data)
		const eventTypesResult = await db
			.prepare(
				`SELECT id, user_id, organization_id, name, slug, description, category, durations_json,
				        duration_minutes, icon_name, color, cover_image, is_free_only, is_active
				 FROM event_types
				 WHERE COALESCE(is_active, 1) = 1
				 ORDER BY created_at ASC`
			)
			.all();

		const eventTypes = (eventTypesResult.results as any[]) || [];

		// 3. Fetch active team members / experts
		const expertsResult = await db
			.prepare(
				`SELECT u.id, u.name, u.email, u.slug, u.profile_image, u.role_title, u.bio,
				        u.session_pricing, u.is_free_consultation, u.brand_color
				 FROM users u
				 WHERE u.is_active = 1
				 ORDER BY u.created_at ASC`
			)
			.all();

		const allExperts = (expertsResult.results as any[]).map((expert) => {
			let parsedPricing: any[] = [];
			try {
				parsedPricing = expert.session_pricing ? JSON.parse(expert.session_pricing) : [];
			} catch {}
			return {
				...expert,
				session_pricing: parsedPricing
			};
		});

		// 4. Fetch assignments between consultation events and experts
		const assignmentsResult = await db
			.prepare('SELECT event_type_id, user_id, custom_pricing FROM event_type_members WHERE is_active = 1')
			.all();

		const assignments = (assignmentsResult.results as any[]) || [];

		// Strictly group experts per service - ONLY assigned experts are listed
		const eventTypesWithExperts = eventTypes.map((et) => {
			const assignedUserIds = assignments
				.filter((a) => a.event_type_id === et.id)
				.map((a) => a.user_id);

			let assignedExperts = allExperts.filter((exp) => assignedUserIds.includes(exp.id));

			// If no junction records exist yet, support legacy creator if active
			if (assignedExperts.length === 0 && et.user_id) {
				const creatorExpert = allExperts.find((exp) => exp.id === et.user_id);
				if (creatorExpert) {
					assignedExperts = [creatorExpert];
				}
			}

			let parsedDurations: number[] = [30, 60];
			try {
				parsedDurations = et.durations_json ? JSON.parse(et.durations_json) : [30, 60];
			} catch {}

			return {
				...et,
				durations: parsedDurations,
				experts: assignedExperts
			};
		});

		return {
			organization,
			eventTypes: eventTypesWithExperts,
			allExperts
		};
	} catch (err) {
		console.error('Failed to load consultation portal data:', err);
		return {
			organization: {
				name: 'Neubofy™',
				slug: 'neubofy',
				profile_image: 'https://neubofy.in/neubofylogo.png',
				brand_color: '#3b82f6'
			},
			eventTypes: [],
			allExperts: []
		};
	}
};
