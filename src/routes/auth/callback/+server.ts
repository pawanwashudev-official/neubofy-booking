/**
 * Google OAuth callback handler
 */

import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exchangeCodeForTokens, getGoogleUserInfo, createSessionToken } from '$lib/server/auth';

export const GET: RequestHandler = async ({ url, platform, cookies }) => {
	const env = platform?.env;
	if (!env) {
		throw error(500, 'Platform env not available');
	}

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const errorParam = url.searchParams.get('error');

	// Handle OAuth errors
	if (errorParam) {
		throw error(400, `OAuth error: ${errorParam}`);
	}

	if (!code || !state) {
		throw error(400, 'Missing code or state parameter');
	}

	// Verify state to prevent CSRF
	const storedState = await env.KV.get(`oauth_state:${state}`);
	if (!storedState) {
		throw error(400, 'Invalid state parameter');
	}

	// Delete used state
	await env.KV.delete(`oauth_state:${state}`);

	const clientId = env.GOOGLE_CLIENT_ID;
	const clientSecret = env.GOOGLE_CLIENT_SECRET;
	const appUrl = env.APP_URL;
	const ownerEmail = (env.ORGANIZATION_OWNER_EMAIL || '').trim().toLowerCase();

	if (!clientId || !clientSecret || !appUrl) {
		throw error(500, 'Missing OAuth configuration');
	}

	try {
		// Exchange code for tokens
		const redirectUri = `${appUrl}/auth/callback`;
		const tokens = await exchangeCodeForTokens(code, clientId, clientSecret, redirectUri);

		// Get user info
		const userInfo = await getGoogleUserInfo(tokens.access_token);

		const normalizedEmail = userInfo.email.trim().toLowerCase();
		const db = env.DB;
		if (storedState.startsWith('calendar:')) {
			const userId = storedState.slice('calendar:'.length);
			const member = await db.prepare('SELECT id FROM organization_members WHERE user_id = ? AND is_active = 1 LIMIT 1').bind(userId).first();
			if (!member) throw error(403, 'Your account is not active in an organization.');
			await db.prepare('UPDATE users SET google_refresh_token = ?, last_login_at = CURRENT_TIMESTAMP WHERE id = ?')
				.bind(tokens.refresh_token || null, userId).run();
			throw redirect(302, '/dashboard/calendars?success=google_connected');
		}

		let user = await db.prepare('SELECT id, is_active FROM users WHERE lower(email) = ?').bind(normalizedEmail).first<{ id: string; is_active: number | null }>();

		if (!user) {
			const invitation = await db
				.prepare(
					`SELECT id, organization_id, role FROM organization_invitations
					 WHERE lower(email) = ? AND accepted_at IS NULL AND revoked_at IS NULL
					 AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC LIMIT 1`
				)
				.bind(normalizedEmail)
				.first<{ id: string; organization_id: string; role: 'admin' | 'member' }>();

			if (!ownerEmail || normalizedEmail !== ownerEmail) {
				if (!invitation) throw error(403, 'Access denied. An active organization invitation is required.');
			}

			const userId = crypto.randomUUID();
			const slug = `${normalizedEmail.split('@')[0].replace(/[^a-z0-9]/g, '') || 'user'}-${userId.slice(0, 8)}`;

			await db
				.prepare(
					`INSERT INTO users (id, email, name, slug, google_refresh_token, is_active, last_login_at, created_at)
					VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
				)
				.bind(
					userId,
					normalizedEmail,
					userInfo.name,
					slug,
					tokens.refresh_token || null
				)
				.run();

			user = { id: userId, is_active: 1 };

			let existingOrganization = await db.prepare('SELECT id FROM organizations ORDER BY created_at LIMIT 1').first<{ id: string }>();
			if (!existingOrganization && !invitation) {
				const organizationId = crypto.randomUUID();
				const organizationSlug = `${normalizedEmail.split('@')[0].replace(/[^a-z0-9]/g, '') || 'organization'}-${organizationId.slice(0, 8)}`;
				await db
					.prepare(
						`INSERT INTO organizations (id, name, slug, contact_email, reply_to_email, created_at, updated_at)
						 VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
					)
					.bind(organizationId, 'Neubofy', organizationSlug, normalizedEmail, normalizedEmail)
					.run();
				existingOrganization = { id: organizationId };
			}
			const organizationId = invitation?.organization_id || existingOrganization?.id;
			if (!organizationId) throw error(500, 'Organization setup is incomplete.');
			await db.prepare('INSERT INTO organization_members (organization_id, user_id, role) VALUES (?, ?, ?)')
				.bind(organizationId, userId, invitation?.role || 'owner').run();
			if (invitation) {
				await db.prepare('UPDATE organization_invitations SET accepted_at = CURRENT_TIMESTAMP WHERE id = ?').bind(invitation.id).run();
			}
		} else {
			if (user.is_active === 0) throw error(403, 'Your account has been deactivated.');
			const membership = await db.prepare(
				' SELECT id FROM organization_members WHERE user_id = ? AND is_active = 1 LIMIT 1'
			).bind(user.id).first();
			if (!membership) throw error(403, 'You do not have an active organization membership.');

			await db
				.prepare(
					`UPDATE users
					SET google_refresh_token = COALESCE(?, google_refresh_token),
						email = ?,
						name = ?,
						last_login_at = CURRENT_TIMESTAMP
					WHERE id = ?`
				)
				.bind(
					tokens.refresh_token || null,
					normalizedEmail,
					userInfo.name,
					user.id
				)
				.run();
		}

		// Create session token (note: user.id is now a string UUID)
		const sessionToken = await createSessionToken(user.id, env.JWT_SECRET);

		// Set session cookie
		cookies.set('session', sessionToken, {
			path: '/',
			httpOnly: true,
			secure: appUrl.startsWith('https'),
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});

		throw redirect(302, '/dashboard');
	} catch (err: any) {
		// Re-throw redirects
		if (err?.status && (err?.location || err?.status >= 400)) {
			throw err;
		}
		console.error('OAuth callback error:', err);
		throw error(500, `Authentication failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
	}
};
