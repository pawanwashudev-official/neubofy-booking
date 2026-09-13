import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getAuthContext, isOrganizationAdmin, isOrganizationOwner } from '$lib/server/auth';
import { isValidEmail, validateLength, MAX_LENGTHS } from '$lib/server/validation';

export const GET = async (event: RequestEvent) => {
	const auth = await getAuthContext(event);
	if (!auth) throw error(401, 'Unauthorized');
	if (!isOrganizationAdmin(auth.role)) throw error(403, 'Organization administrator access required');
	const db = event.platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');
	const organization = await db.prepare(
		`SELECT id, name, slug, profile_image, brand_color, timezone, contact_email,
			reply_to_email, email_from, settings, setup_complete
		 FROM organizations WHERE id = ?`
	).bind(auth.organizationId).first();
	return json({ organization, role: auth.role });
};

export const PUT = async (event: RequestEvent) => {
	const auth = await getAuthContext(event);
	if (!auth) throw error(401, 'Unauthorized');
	if (!isOrganizationOwner(auth.role)) throw error(403, 'Only the organization owner can update organization settings');
	const db = event.platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');
	const body = await event.request.json() as {
		name?: string; slug?: string; profileImage?: string | null; brandColor?: string;
		timezone?: string; contactEmail?: string; replyToEmail?: string; emailFrom?: string;
	};
	const name = body.name?.trim();
	const slug = body.slug?.trim().toLowerCase();
	if (!name || !slug || !body.timezone || !body.contactEmail || !body.replyToEmail || !body.emailFrom) {
		throw error(400, 'Organization name, slug, timezone, contact email, sender email, and reply-to email are required');
	}
	const lengthError = validateLength(name, 'Organization name', MAX_LENGTHS.name, true);
	if (lengthError) throw error(400, lengthError);
	if (!/^[a-z0-9-]+$/.test(slug)) throw error(400, 'Slug can only contain lowercase letters, numbers, and hyphens');
	for (const [value, label] of [[body.contactEmail, 'contact'], [body.replyToEmail, 'reply-to'], [body.emailFrom, 'sender']] as const) {
		if (!isValidEmail(value)) throw error(400, `Invalid ${label} email address`);
	}
	const conflict = await db.prepare('SELECT id FROM organizations WHERE slug = ? AND id != ?').bind(slug, auth.organizationId).first();
	if (conflict) throw error(409, 'That public slug is already in use');
	await db.prepare(
		`UPDATE organizations SET name = ?, slug = ?, profile_image = ?, brand_color = ?, timezone = ?,
			contact_email = ?, reply_to_email = ?, email_from = ?, setup_complete = 1, updated_at = CURRENT_TIMESTAMP
		 WHERE id = ?`
	).bind(name, slug, body.profileImage || null, body.brandColor || '#3b82f6', body.timezone, body.contactEmail, body.replyToEmail, body.emailFrom, auth.organizationId).run();
	return json({ success: true });
};
