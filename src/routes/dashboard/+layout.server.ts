/**
 * Dashboard Layout Server Load
 * Enforces authentication, loads user profile, role, organization details,
 * and expert members list for the workspace switcher.
 */

import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getAuthContext, isOrganizationAdmin, getCurrentUser } from '$lib/server/auth';

export const load: LayoutServerLoad = async (event) => {
	const userId = await getCurrentUser(event);
	if (!userId) {
		throw redirect(302, '/auth/login');
	}

	const db = event.platform?.env?.DB;
	if (!db) {
		return {
			user: null,
			organization: null,
			role: 'member',
			isAdmin: false,
			teamMembers: []
		};
	}

	// 1. Fetch user
	const user = await db
		.prepare(
			`SELECT id, name, email, slug, profile_image, brand_color, role_title, bio, phone,
			        session_pricing, is_free_consultation, google_refresh_token, outlook_refresh_token
			 FROM users WHERE id = ?`
		)
		.bind(userId)
		.first<{
			id: string;
			name: string;
			email: string;
			slug: string;
			profile_image: string | null;
			brand_color: string | null;
			role_title: string | null;
			bio: string | null;
			phone: string | null;
			session_pricing: string | null;
			is_free_consultation: number | null;
			google_refresh_token: string | null;
			outlook_refresh_token: string | null;
		}>();

	if (!user) {
		throw redirect(302, '/auth/login');
	}

	// 2. Fetch membership role
	const authContext = await getAuthContext(event);
	const role = authContext?.role || 'member';
	const isAdmin = isOrganizationAdmin(role);

	// 3. Fetch organization
	const orgId = authContext?.organizationId;
	const organization = await db
		.prepare('SELECT id, name, slug, brand_color, contact_email, profile_image FROM organizations WHERE id = ?')
		.bind(orgId || 'org_neubofy_main')
		.first<{
			id: string;
			name: string;
			slug: string;
			brand_color: string | null;
			contact_email: string | null;
			profile_image: string | null;
		}>();

	// 4. If Admin or Owner, load team members for the Expert Workspace Switcher
	let teamMembers: Array<{
		id: string;
		name: string;
		email: string;
		role_title: string | null;
		profile_image: string | null;
		role: string;
	}> = [];

	if (isAdmin) {
		const membersResult = await db
			.prepare(
				`SELECT u.id, u.name, u.email, u.role_title, u.profile_image, om.role
				 FROM users u
				 JOIN organization_members om ON om.user_id = u.id
				 WHERE om.is_active = 1
				 ORDER BY CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.name ASC`
			)
			.all();
		teamMembers = (membersResult.results as any[]) || [];
	}

	let parsedPricing = [];
	try {
		parsedPricing = user.session_pricing ? JSON.parse(user.session_pricing) : [];
	} catch {}

	return {
		user: {
			...user,
			session_pricing: parsedPricing,
			googleConnected: !!user.google_refresh_token,
			outlookConnected: !!user.outlook_refresh_token
		},
		organization: organization || {
			id: 'org_neubofy_main',
			name: 'Neubofy™',
			slug: 'neubofy',
			brand_color: '#3b82f6',
			contact_email: 'contact@neubofy.in',
			profile_image: 'https://neubofy.in/neubofylogo.png'
		},
		role,
		isAdmin,
		teamMembers
	};
};
