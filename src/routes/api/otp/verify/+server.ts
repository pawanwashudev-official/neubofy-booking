/**
 * OTP Verify API endpoint
 * Validates the 6-digit code with timing-safe comparison and issues an HMAC-signed verification token.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyOtpCode } from '$lib/server/email-verification';

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = platform?.env;
	if (!env) {
		throw error(500, 'Platform env not available');
	}

	try {
		const body = (await request.json()) as {
			email?: string;
			code?: string;
			purpose?: string;
		};
		const email = body.email?.trim().toLowerCase();
		const code = body.code?.trim();
		const purpose = body.purpose || 'booking';

		if (!email || !code) {
			throw error(400, 'Email and verification code are required.');
		}

		const secret = env.JWT_SECRET;
		if (!secret) {
			throw error(500, 'Server configuration error: JWT_SECRET is missing');
		}

		const db = env.DB;
		const result = await verifyOtpCode(db, email, code, secret, purpose);

		if (!result.success || !result.token) {
			throw error(result.status || 400, result.error || 'Verification failed.');
		}

		return json({
			success: true,
			verifiedToken: result.token,
			message: 'Email successfully verified!'
		});
	} catch (err: any) {
		if (err?.status) throw err;
		console.error('OTP Verify Error:', err);
		throw error(500, err?.message || 'Verification failed.');
	}
};

