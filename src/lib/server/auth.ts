/**
 * Server-side authentication utilities for Google OAuth and organization access.
 */

import type { RequestEvent } from '@sveltejs/kit';

export type OrganizationRole = 'owner' | 'admin' | 'member';

export interface AuthContext {
	userId: string;
	organizationId: string;
	role: OrganizationRole;
}

export interface GoogleTokenResponse {
	access_token: string;
	refresh_token?: string;
	expires_in: number;
	token_type: string;
	scope: string;
}

export interface GoogleUserInfo {
	id: string;
	email: string;
	name: string;
	picture: string;
}

/**
 * Generate OAuth authorization URL
 */
export function getAuthUrl(clientId: string, redirectUri: string, state: string, includeCalendar = false): string {
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: [
			'https://www.googleapis.com/auth/userinfo.email',
			'https://www.googleapis.com/auth/userinfo.profile',
			...(includeCalendar ? [
				'https://www.googleapis.com/auth/calendar',
				'https://www.googleapis.com/auth/calendar.events'
			] : [])
		].join(' '),
		access_type: 'offline',
		prompt: 'consent',
		state
	});

	return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
	code: string,
	clientId: string,
	clientSecret: string,
	redirectUri: string
): Promise<GoogleTokenResponse> {
	const response = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			code,
			client_id: clientId,
			client_secret: clientSecret,
			redirect_uri: redirectUri,
			grant_type: 'authorization_code'
		})
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to exchange code for tokens: ${error}`);
	}

	return response.json();
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
	refreshToken: string,
	clientId: string,
	clientSecret: string
): Promise<GoogleTokenResponse> {
	const response = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			refresh_token: refreshToken,
			client_id: clientId,
			client_secret: clientSecret,
			grant_type: 'refresh_token'
		})
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to refresh access token: ${error}`);
	}

	return response.json();
}

/**
 * Get user info from Google
 */
export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
	const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
		headers: {
			Authorization: `Bearer ${accessToken}`
		}
	});

	if (!response.ok) {
		throw new Error('Failed to get user info');
	}

	return response.json();
}

/**
 * Sign data using Web Crypto HMAC-SHA256
 */
async function signHmac(data: string, secret: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
	const hashArray = Array.from(new Uint8Array(signature));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	const encoder = new TextEncoder();
	const bufA = encoder.encode(a);
	const bufB = encoder.encode(b);
	let result = 0;
	for (let i = 0; i < bufA.length; i++) {
		result |= bufA[i] ^ bufB[i];
	}
	return result === 0;
}

/**
 * Hash string using Web Crypto API (legacy support)
 */
async function hashString(str: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(str);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create session token with HMAC-SHA256 signature
 */
export async function createSessionToken(
	userId: string,
	secret: string
): Promise<string> {
	const now = Date.now();
	const payload = {
		iss: 'neubofy-booking',
		sub: userId,
		userId,
		iat: now,
		exp: now + 7 * 24 * 60 * 60 * 1000
	};

	const data = btoa(JSON.stringify(payload));
	const signature = await signHmac(data, secret);

	return `${data}.${signature}`;
}

/**
 * Verify session token (HMAC-SHA256 with fallback to legacy hash for existing sessions)
 */
export async function verifySessionToken(
	token: string,
	secret: string
): Promise<{ userId: string } | null> {
	try {
		const parts = token.split('.');
		if (parts.length !== 2) return null;
		const [data, signature] = parts;

		// 1. Modern HMAC-SHA256 check
		const expectedHmac = await signHmac(data, secret);
		let isValid = timingSafeEqual(signature, expectedHmac);

		// 2. Legacy fallback check
		if (!isValid) {
			const expectedLegacy = await hashString(`${data}.${secret}`);
			isValid = timingSafeEqual(signature, expectedLegacy);
		}

		if (!isValid) {
			return null;
		}

		const payload = JSON.parse(atob(data));

		const now = Date.now();
		if (payload.exp && now > payload.exp) {
			return null;
		}
		if (payload.iat && now - payload.iat > 7 * 24 * 60 * 60 * 1000) {
			return null;
		}

		const userId = payload.sub || payload.userId;
		if (!userId) return null;

		return { userId };
	} catch {
		return null;
	}
}

/**
 * Get current user from session cookie
 */
export async function getCurrentUser(
	event: RequestEvent
): Promise<string | null> {
	const sessionToken = event.cookies.get('session');
	if (!sessionToken) {
		return null;
	}

	const jwtSecret = event.platform?.env?.JWT_SECRET;
	if (!jwtSecret) {
		console.error('FATAL: JWT_SECRET environment variable is not configured');
		return null;
	}
	const session = await verifySessionToken(sessionToken, jwtSecret);
	return session?.userId ?? null;
}

/** Resolve the active organization membership on every request. */
export async function getAuthContext(event: RequestEvent): Promise<AuthContext | null> {
	const userId = await getCurrentUser(event);
	const db = event.platform?.env?.DB;
	if (!userId || !db) return null;

	let membership: { organizationId: string; role: OrganizationRole } | null = null;
	try {
		membership = await db
			.prepare(
				`SELECT organization_id as organizationId, role
				 FROM organization_members
				 WHERE user_id = ? AND is_active = 1
				 ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END
				 LIMIT 1`
			)
			.bind(userId)
			.first<{ organizationId: string; role: OrganizationRole }>();
	} catch {
		try {
			membership = await db
				.prepare(
					`SELECT organization_id as organizationId, role
					 FROM organization_members
					 WHERE user_id = ?
					 LIMIT 1`
				)
				.bind(userId)
				.first<{ organizationId: string; role: OrganizationRole }>();
		} catch (err2) {
			console.error('Failed to query organization_members in getAuthContext:', err2);
		}
	}

	// Auto-heal privilege escalation removed: users without an active membership cannot access dashboard
	return membership ? { userId, ...membership } : null;
}

export async function requireAuthContext(event: RequestEvent): Promise<AuthContext> {
	const context = await getAuthContext(event);
	if (!context) throw new Error('Not authenticated');
	return context;
}

export function isOrganizationAdmin(role: OrganizationRole): boolean {
	return role === 'owner' || role === 'admin';
}

export function isOrganizationOwner(role: OrganizationRole): boolean {
	return role === 'owner';
}

/**
 * Require authentication - redirect to login if not authenticated
 */
export async function requireAuth(event: RequestEvent): Promise<string> {
	const userId = await getCurrentUser(event);
	if (!userId) {
		throw new Error('Not authenticated');
	}
	return userId;
}

export type WorkspaceMode = 'personal' | 'org';

export function getWorkspaceMode(event: RequestEvent, role: OrganizationRole): WorkspaceMode {
	// Standard members can only ever access personal workspace
	if (!isOrganizationAdmin(role)) {
		return 'personal';
	}

	// URL query parameter takes priority if present: ?workspace=personal or ?workspace=org
	const queryMode = event.url.searchParams.get('workspace');
	if (queryMode === 'personal' || queryMode === 'org') {
		return queryMode;
	}

	// Read cookie preference
	const cookieMode = event.cookies.get('neubofy_workspace_mode');
	if (cookieMode === 'personal' || cookieMode === 'org') {
		return cookieMode;
	}

	// Default to 'org' for admins/owners
	return 'org';
}

