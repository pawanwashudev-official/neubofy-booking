/**
 * Dashboard Layout Server Load
 * Enforces authentication, loads user profile, role, organization details,
 * and expert members list for the workspace switcher.
 */

import { redirect, error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getAuthContext, isOrganizationAdmin, getCurrentUser, getWorkspaceMode } from '$lib/server/auth';

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
			teamMembers: [],
			workspaceMode: 'personal' as const
		};
	}

	// 1. Fetch user with safe fallback
	let user: any = null;
	try {
		user = await db
			.prepare(
				`SELECT id, name, email, slug, profile_image, brand_color, role_title, bio, phone,
				        session_pricing, is_free_consultation, google_refresh_token, outlook_refresh_token
				 FROM users WHERE id = ?`
			)
			.bind(userId)
			.first();
	} catch (e1) {
		try {
			user = await db
				.prepare(
					`SELECT id, name, email, slug, profile_image, brand_color, google_refresh_token
					 FROM users WHERE id = ?`
				)
				.bind(userId)
				.first();
		} catch (e2) {
			console.error('Failed to load user in dashboard layout:', e2);
		}
	}

	if (!user) {
		throw redirect(302, '/auth/login');
	}

	// 2. Fetch membership role
	let authContext = null;
	try {
		authContext = await getAuthContext(event);
	} catch (errAuth) {
		console.error('Error resolving auth context:', errAuth);
	}

	if (!authContext) {
		// Attempt auto-repair or fallback if user exists
		throw error(403, {
			message: 'Organization Membership Required',
			reason: 'Your account is authenticated, but you have not been added as an active expert or member of the Neubofy organization.',
			permissionNeeded: 'Member Expert or Administrator Role assigned by an Organization Owner',
			currentRole: 'Unassigned Account'
		});
	}

	const role = authContext.role;
	const isAdmin = isOrganizationAdmin(role);
	const workspaceMode = getWorkspaceMode(event, role);

	// 3. Fetch organization
	const orgId = authContext?.organizationId;
	let organization: any = null;
	try {
		organization = await db
			.prepare('SELECT id, name, slug, brand_color, contact_email, profile_image FROM organizations WHERE id = ?')
			.bind(orgId || 'org_neubofy_main')
			.first();
	} catch (eOrg) {
		console.error('Failed to load organization in layout:', eOrg);
	}

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
		try {
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
		} catch {
			try {
				const membersResult = await db
					.prepare(
						`SELECT u.id, u.name, u.email, u.profile_image, om.role
						 FROM users u
						 JOIN organization_members om ON om.user_id = u.id
						 ORDER BY u.name ASC`
					)
					.all();
				teamMembers = (membersResult.results as any[]) || [];
			} catch (eMembers) {
				console.error('Failed to query team members in layout:', eMembers);
			}
		}
	}

	let parsedPricing = [];
	try {
		parsedPricing = user.session_pricing ? JSON.parse(user.session_pricing) : [];
	} catch {}

	return {
		user: {
			id: user.id,
			name: user.name,
			email: user.email,
			slug: user.slug,
			profile_image: user.profile_image,
			brand_color: user.brand_color,
			role_title: user.role_title,
			bio: user.bio,
			phone: user.phone,
			is_free_consultation: user.is_free_consultation,
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
		teamMembers,
		workspaceMode
	};
};
