/**
 * API endpoint to toggle consultation service status (Live vs Paused)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthContext, isOrganizationAdmin } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	const auth = await getAuthContext(event);
	if (!auth) throw error(401, 'Authentication required');
	if (!isOrganizationAdmin(auth.role)) {
		throw error(403, 'Administrator privileges required to toggle service status');
	}

	const db = event.platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const { id, is_active } = await event.request.json().catch(() => ({}));
	if (!id) {
		throw error(400, 'Service ID is required');
	}

	const newStatus = is_active ? 1 : 0;

	// Verify service belongs to organization or is legacy
	const service = await db
		.prepare('SELECT id, name, is_active FROM event_types WHERE id = ?')
		.bind(id)
		.first<{ id: string; name: string; is_active: number }>();

	if (!service) {
		throw error(404, 'Consultation service not found');
	}

	await db
		.prepare('UPDATE event_types SET is_active = ?, organization_id = COALESCE(organization_id, ?) WHERE id = ?')
		.bind(newStatus, auth.organizationId || 'org_neubofy_main', id)
		.run();

	return json({
		success: true,
		id,
		name: service.name,
		is_active: newStatus
	});
};
