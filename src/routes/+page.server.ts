/**
 * Main page - shows event types for single-user setup
 */

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	const db = platform?.env?.DB;
	if (!db) {
		// If database not available, show the landing page
		return { user: null, eventTypes: [] };
	}

	// Resolve the public organization for this deployment.
	const user = await db
		.prepare('SELECT id, name, slug, contact_email as email, profile_image, brand_color FROM organizations ORDER BY created_at LIMIT 1')
		.first<{ id: string; name: string; slug: string; email: string | null; profile_image: string | null; brand_color: string | null }>();

	if (!user) {
		// No user exists yet, show the landing page
		return { user: null, eventTypes: [] };
	}

	// Get active event types
	const eventTypes = await db
		.prepare(
			`SELECT id, name, slug, duration_minutes as duration, description, is_active,
				(SELECT COUNT(*) FROM event_type_hosts h WHERE h.event_type_id = event_types.id AND h.is_active = 1) as expert_count
			FROM event_types
			WHERE organization_id = ? AND is_active = 1
			ORDER BY name ASC`
		)
		.bind(user.id)
		.all<{
			id: string;
			name: string;
			slug: string;
			duration: number;
			description: string;
			is_active: number;
			expert_count: number;
		}>();

	return {
		user: {
			name: user.name,
			slug: user.slug,
			profileImage: user.profile_image,
			brandColor: user.brand_color
		},
		eventTypes: eventTypes.results
	};
};
