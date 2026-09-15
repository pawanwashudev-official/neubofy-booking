/**
 * Firebase Config Provider Endpoint
 * Reads Cloudflare Secret variables (individual or single JSON)
 * and returns configuration safely to the client.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
	const env = (platform?.env || {}) as Record<string, any>;

	// 1. Check for single JSON secret: FIREBASE_CONFIG or PUBLIC_FIREBASE_CONFIG
	const singleSecret = env.FIREBASE_CONFIG || env.PUBLIC_FIREBASE_CONFIG;
	if (singleSecret) {
		try {
			const parsed = typeof singleSecret === 'string' ? JSON.parse(singleSecret) : singleSecret;
			return json(parsed, {
				headers: {
					'Cache-Control': 'public, max-age=3600'
				}
			});
		} catch (e) {
			console.error('[api:config:firebase] Failed to parse FIREBASE_CONFIG JSON secret:', e);
		}
	}

	// 2. Read individual Cloudflare secret variables (support full and UI-truncated variable names)
	const apiKey = env.PUBLIC_FIREBASE_API_KEY || env.FIREBASE_API_KEY;
	if (apiKey) {
		const authDomain = env.PUBLIC_FIREBASE_AUTH_DOMAIN || env.PUBLIC_FIREBASE_AUTH_DC || env.FIREBASE_AUTH_DOMAIN || 'neubofy-booking.firebaseapp.com';
		const projectId = env.PUBLIC_FIREBASE_PROJECT_ID || env.PUBLIC_FIREBASE_PROJECT || env.FIREBASE_PROJECT_ID || 'neubofy-booking';
		const storageBucket = env.PUBLIC_FIREBASE_STORAGE_BUCKET || env.PUBLIC_FIREBASE_STORAGE || env.FIREBASE_STORAGE_BUCKET || 'neubofy-booking.firebasestorage.app';
		const messagingSenderId = env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || env.PUBLIC_FIREBASE_MESSAGI || env.FIREBASE_MESSAGING_SENDER_ID || '9603703682';
		const appId = env.PUBLIC_FIREBASE_APP_ID || env.FIREBASE_APP_ID || '1:9603703682:web:85f2e5798d84a78041259b';
		const measurementId = env.PUBLIC_FIREBASE_MEASUREMENT_ID || env.PUBLIC_FIREBASE_MEASURE || env.FIREBASE_MEASUREMENT_ID || 'G-DGY9XJ758T';

		return json({
			apiKey,
			authDomain,
			projectId,
			storageBucket,
			messagingSenderId,
			appId,
			measurementId
		}, {
			headers: {
				'Cache-Control': 'public, max-age=3600'
			}
		});
	}

	return json(
		{ error: 'FIREBASE_CONFIG secret is not configured in Cloudflare' },
		{ status: 503 }
	);
};
