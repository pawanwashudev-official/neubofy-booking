/**
 * Logout endpoint - supports both POST and GET requests
 */

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const handleLogout: RequestHandler = async ({ cookies }) => {
	// Clear session cookie across entire domain
	cookies.delete('session', { path: '/' });

	throw redirect(302, '/auth/login?logged_out=1');
};

export const POST: RequestHandler = handleLogout;
export const GET: RequestHandler = handleLogout;

