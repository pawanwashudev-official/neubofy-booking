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

	const profile = await db
		.prepare(
			`SELECT id, name, email, slug, profile_image, brand_color, contact_email,
			        role_title, bio, phone, session_pricing, is_free_consultation,
			        google_refresh_token, outlook_refresh_token, timezone
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
			contact_email: string | null;
			role_title: string | null;
			bio: string | null;
			phone: string | null;
			session_pricing: string | null;
			is_free_consultation: number | null;
			google_refresh_token: string | null;
			outlook_refresh_token: string | null;
			timezone: string | null;
		}>();

	let parsedPricing = [];
	try {
		parsedPricing = profile?.session_pricing ? JSON.parse(profile.session_pricing) : [];
	} catch {}

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
					googleConnected: !!profile.google_refresh_token
				}
			: null
	};
};
