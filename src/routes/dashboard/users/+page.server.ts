import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthContext, isOrganizationAdmin } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	const auth = await getAuthContext(event);
	if (!auth) throw redirect(302, '/auth/login');
	if (!isOrganizationAdmin(auth.role)) throw redirect(302, '/dashboard');
	return {
		role: auth.role,
		organization: await event.platform?.env?.DB
			?.prepare('SELECT name FROM organizations WHERE id = ?')
			.bind(auth.organizationId)
			.first<{ name: string }>()
	};
};
