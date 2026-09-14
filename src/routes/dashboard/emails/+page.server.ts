/**
 * Email settings page - requires authentication
 */

import { redirect, type RequestEvent } from '@sveltejs/kit';
import { getAuthContext, isOrganizationOwner } from '$lib/server/auth';

export const load = async (event: RequestEvent) => {
	const auth = await getAuthContext(event);

	if (!auth) {
		throw redirect(302, '/auth/login');
	}
	if (!isOrganizationOwner(auth.role)) throw redirect(302, '/dashboard');

	return {};
};
