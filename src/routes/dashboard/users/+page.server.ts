import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthContext, isOrganizationAdmin } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	const auth = await getAuthContext(event);
	if (!auth) throw redirect(302, '/auth/login');
	if (!isOrganizationAdmin(auth.role)) {
		throw error(403, {
			message: 'Administrator Permission Required',
			reason: 'You need Administrator privileges to invite team members and modify expert roles.',
			permissionNeeded: 'Super Admin or Organization Administrator Role',
			currentRole: auth.role === 'member' ? 'Member Expert' : auth.role
		});
	}
	return {
		role: auth.role,
		organization: await event.platform?.env?.DB
			?.prepare('SELECT name FROM organizations WHERE id = ?')
			.bind(auth.organizationId)
			.first<{ name: string }>()
	};
};
