import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getAuthContext, isOrganizationAdmin, isOrganizationOwner } from '$lib/server/auth';
import { getOrganizationEmailConfig, sendOrganizationInvitationEmail } from '$lib/server/email';
import { isValidEmail } from '$lib/server/validation';

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

export const POST = async (event: RequestEvent) => {
	const auth = await getAuthContext(event);
	if (!auth) throw error(401, 'Unauthorized');
	if (!isOrganizationOwner(auth.role)) throw error(403, 'Only the organization owner can invite users');
	const db = event.platform?.env?.DB;
	const env = event.platform?.env;
	if (!db || !env) throw error(500, 'Database not available');
	if (!env.RESEND_API_KEY) throw error(503, 'Email delivery is not configured');
	const body = await event.request.json() as { email?: string; role?: 'admin' | 'member' };
	const email = body.email?.trim().toLowerCase();
	const role = body.role === 'admin' ? 'admin' : 'member';
	if (!email || !isValidEmail(email)) throw error(400, 'A valid email address is required');
	const existingMember = await db.prepare(
		`SELECT u.id FROM users u JOIN organization_members m ON m.user_id = u.id
		 WHERE m.organization_id = ? AND lower(u.email) = ?`
	).bind(auth.organizationId, email).first();
	if (existingMember) throw error(409, 'This email is already an organization member');
	const existingInvite = await db.prepare(
		`SELECT id FROM organization_invitations WHERE organization_id = ? AND lower(email) = ?
		 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP LIMIT 1`
	).bind(auth.organizationId, email).first();
	if (existingInvite) throw error(409, 'An active invitation already exists for this email');

	const token = crypto.randomUUID() + crypto.randomUUID();
	const tokenBytes = new TextEncoder().encode(token);
	const digestBuffer = await crypto.subtle.digest('SHA-256', tokenBytes);
	const tokenDigest = Array.from(new Uint8Array(digestBuffer)).map((value) => value.toString(16).padStart(2, '0')).join('');
	const invitationId = crypto.randomUUID();
	await db.prepare(
		`INSERT INTO organization_invitations (id, organization_id, email, role, invited_by, token_digest, expires_at)
		 VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+7 days'))`
	).bind(invitationId, auth.organizationId, email, role, auth.userId, tokenDigest).run();

	const organization = await db.prepare('SELECT name FROM organizations WHERE id = ?').bind(auth.organizationId).first<{ name: string }>();
	const emailConfig = await getOrganizationEmailConfig(db, auth.userId, env);
	try {
		await sendOrganizationInvitationEmail(
			{ organizationName: organization?.name || 'Neubofy', inviteeEmail: email, role, invitationUrl: `${env.APP_URL || ''}/auth/login` },
			{ apiKey: env.RESEND_API_KEY || '', from: emailConfig.from, replyTo: emailConfig.replyTo }
		);
	} catch (sendError) {
		await db.prepare('DELETE FROM organization_invitations WHERE id = ?').bind(invitationId).run();
		console.error('Invitation email error:', sendError);
		throw error(502, 'The invitation could not be sent');
	}
	return json({ success: true });
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
