import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthContext, isOrganizationOwner } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	const auth = await getAuthContext(event);
	if (!auth) throw redirect(302, '/auth/login');
	if (!isOrganizationOwner(auth.role)) {
		throw error(403, {
			message: 'Organization Owner Permission Required',
			reason: 'Only the organization Owner / Super Admin can edit organization identity, email credentials, and core branding.',
			permissionNeeded: 'Organization Owner (Super Admin) Role',
			currentRole: auth.role === 'admin' ? 'Administrator' : 'Member Expert'
		});
	}
	const organization = await event.platform?.env?.DB
		?.prepare('SELECT id, name, slug, profile_image, brand_color, timezone, contact_email, reply_to_email, email_from, setup_complete FROM organizations WHERE id = ?')
		.bind(auth.organizationId)
		.first();
	return { organization };
};
