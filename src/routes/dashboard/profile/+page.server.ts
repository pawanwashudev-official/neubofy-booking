/**
 * Expert Profile & Session Rates Page Server Load
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getCurrentUser } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	const userId = await getCurrentUser(event);
	if (!userId) throw redirect(302, '/auth/login');

	const db = event.platform?.env?.DB;
	if (!db) {
		return { profile: null };
	}

	let profile: any = null;
	try {
		profile = await db
			.prepare(
				`SELECT id, name, email, slug, profile_image, brand_color, contact_email,
				        role_title, bio, phone, session_pricing, is_free_consultation,
				        google_refresh_token, outlook_refresh_token,
				        google_calendar_connected, outlook_calendar_connected, timezone
				 FROM users WHERE id = ? AND COALESCE(is_deleted, 0) = 0`
			)
			.bind(userId)
			.first();
	} catch (err) {
		console.error('Failed to query user in profile page:', err);
	}

	let parsedPricing = [];
	try {
		parsedPricing = profile?.session_pricing ? JSON.parse(profile.session_pricing) : [];
	} catch (e) {
		console.warn('Failed to parse user session_pricing JSON:', e);
	}

	if (!parsedPricing || parsedPricing.length === 0) {
		parsedPricing = [
			{ duration: 30, price: 999, label: '30 Min Strategy Session' },
			{ duration: 60, price: 1999, label: '60 Min Architecture Deep-Dive' }
		];
	}

	return {
		profile: profile
			? {
					...profile,
					session_pricing: parsedPricing,
					googleConnected: !!profile.google_calendar_connected && !!profile.google_refresh_token,
					outlookConnected: !!profile.outlook_calendar_connected && !!profile.outlook_refresh_token
				}
			: null
	};
};
