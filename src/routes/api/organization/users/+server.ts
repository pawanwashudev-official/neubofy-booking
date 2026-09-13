import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getAuthContext, isOrganizationAdmin, isOrganizationOwner } from '$lib/server/auth';

export const GET = async (event: RequestEvent) => {
	const auth = await getAuthContext(event);
	if (!auth) throw error(401, 'Unauthorized');
	if (!isOrganizationAdmin(auth.role)) throw error(403, 'Organization administrator access required');

	const db = event.platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');
	const members = await db.prepare(
		`SELECT m.user_id, m.role, m.is_active, m.joined_at,
			u.name, u.email, u.profile_image, u.last_login_at,
			(SELECT COUNT(*) FROM event_types e WHERE e.user_id = u.id) as event_count,
			(SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id) as booking_count
		 FROM organization_members m
		 JOIN users u ON u.id = m.user_id
		 WHERE m.organization_id = ?
		 ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.name`
	).bind(auth.organizationId).all();
	return json({ members: members.results });
};

export const DELETE = async (event: RequestEvent) => {
	const auth = await getAuthContext(event);
	if (!auth) throw error(401, 'Unauthorized');
	if (!isOrganizationAdmin(auth.role)) throw error(403, 'Organization administrator access required');

	const body = await event.request.json() as { userId?: string; confirmation?: string };
	if (!body.userId) throw error(400, 'User ID is required');
	if (body.userId === auth.userId) throw error(400, 'Use account settings to remove your own account');

	const db = event.platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');
	const member = await db.prepare(
		`SELECT m.user_id, m.role, u.name FROM organization_members m
		 JOIN users u ON u.id = m.user_id
		 WHERE m.organization_id = ? AND m.user_id = ?`
	).bind(auth.organizationId, body.userId).first<{ user_id: string; role: 'owner' | 'admin' | 'member'; name: string }>();
	if (!member) throw error(404, 'Organization member not found');
	if (member.role === 'owner') throw error(403, 'The organization owner cannot be deleted');
	if (member.role === 'admin' && !isOrganizationOwner(auth.role)) throw error(403, 'Only the owner can delete an administrator');
	if (body.confirmation !== member.name) throw error(400, 'Type the user name to confirm deletion');

	await db.batch([
		db.prepare('DELETE FROM reschedule_proposals WHERE booking_id IN (SELECT id FROM bookings WHERE user_id = ?)').bind(body.userId),
		db.prepare('DELETE FROM scheduled_emails WHERE booking_id IN (SELECT id FROM bookings WHERE user_id = ?)').bind(body.userId),
		db.prepare('DELETE FROM bookings WHERE user_id = ?').bind(body.userId),
		db.prepare('DELETE FROM availability_rules WHERE user_id = ?').bind(body.userId),
		db.prepare('DELETE FROM availability_overrides WHERE user_id = ?').bind(body.userId),
		db.prepare('DELETE FROM event_types WHERE user_id = ?').bind(body.userId),
		db.prepare('DELETE FROM email_templates WHERE user_id = ?').bind(body.userId),
		db.prepare('DELETE FROM webhooks WHERE user_id = ?').bind(body.userId),
		db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(body.userId),
		db.prepare('DELETE FROM organization_invitations WHERE organization_id = ? AND invited_by = ?').bind(auth.organizationId, body.userId),
		db.prepare('DELETE FROM organization_members WHERE organization_id = ? AND user_id = ?').bind(auth.organizationId, body.userId),
		db.prepare('DELETE FROM users WHERE id = ?').bind(body.userId)
	]);

	return json({ success: true });
};

export const PATCH = async (event: RequestEvent) => {
	const auth = await getAuthContext(event);
	if (!auth) throw error(401, 'Unauthorized');
	if (!isOrganizationOwner(auth.role)) throw error(403, 'Only the organization owner can change roles');
	const body = await event.request.json() as { userId?: string; role?: 'admin' | 'member'; isActive?: boolean };
	if (!body.userId) throw error(400, 'User ID is required');
	if (body.userId === auth.userId) throw error(400, 'The owner role cannot be changed here');
	const db = event.platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');
	if (body.role && !['admin', 'member'].includes(body.role)) throw error(400, 'Invalid role');
	await db.prepare(
		`UPDATE organization_members SET role = COALESCE(?, role), is_active = COALESCE(?, is_active)
		 WHERE organization_id = ? AND user_id = ? AND role != 'owner'`
	).bind(body.role || null, body.isActive === undefined ? null : body.isActive ? 1 : 0, auth.organizationId, body.userId).run();
	return json({ success: true });
};
