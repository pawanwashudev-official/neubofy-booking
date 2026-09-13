import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getAuthContext, isOrganizationOwner } from '$lib/server/auth';

export const DELETE = async (event: RequestEvent) => {
	const auth = await getAuthContext(event);
	if (!auth) throw error(401, 'Unauthorized');
	if (!isOrganizationOwner(auth.role)) throw error(403, 'Only the organization owner can delete the organization');

	const body = await event.request.json().catch(() => ({})) as { confirmation?: string };
	const organization = await event.platform?.env?.DB
		?.prepare('SELECT name FROM organizations WHERE id = ?')
		.bind(auth.organizationId)
		.first<{ name: string }>();
	if (!organization) throw error(404, 'Organization not found');
	if (body.confirmation !== organization.name) throw error(400, 'Type the organization name to confirm deletion');

	const db = event.platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	await db.batch([
		db.prepare('DELETE FROM reschedule_proposals WHERE booking_id IN (SELECT id FROM bookings WHERE organization_id = ?)').bind(auth.organizationId),
		db.prepare('DELETE FROM scheduled_emails WHERE booking_id IN (SELECT id FROM bookings WHERE organization_id = ?)').bind(auth.organizationId),
		db.prepare('DELETE FROM bookings WHERE organization_id = ?').bind(auth.organizationId),
		db.prepare('DELETE FROM availability_rules WHERE organization_id = ?').bind(auth.organizationId),
		db.prepare('DELETE FROM availability_overrides WHERE organization_id = ?').bind(auth.organizationId),
		db.prepare('DELETE FROM event_types WHERE organization_id = ?').bind(auth.organizationId),
		db.prepare('DELETE FROM email_templates WHERE organization_id = ?').bind(auth.organizationId),
		db.prepare('DELETE FROM webhooks WHERE user_id IN (SELECT user_id FROM organization_members WHERE organization_id = ?)').bind(auth.organizationId),
		db.prepare('DELETE FROM sessions WHERE user_id IN (SELECT user_id FROM organization_members WHERE organization_id = ?)').bind(auth.organizationId),
		db.prepare('DELETE FROM organization_invitations WHERE organization_id = ?').bind(auth.organizationId),
		db.prepare('DELETE FROM users WHERE id IN (SELECT user_id FROM organization_members WHERE organization_id = ?)').bind(auth.organizationId),
		db.prepare('DELETE FROM organization_members WHERE organization_id = ?').bind(auth.organizationId),
		db.prepare('DELETE FROM organizations WHERE id = ?').bind(auth.organizationId)
	]);

	event.cookies.delete('session', { path: '/' });
	return json({ success: true });
};
