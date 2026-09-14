/**
 * OTP Verify API endpoint
 * Validates the 6-digit code and issues a signed verification token.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

async function generateSignedToken(email: string, secret: string): Promise<string> {
	const payload = {
		email,
		verifiedAt: Date.now()
	};
	const data = btoa(JSON.stringify(payload));
	const encoder = new TextEncoder();
	const keyData = encoder.encode(`${data}.${secret}`);
	const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const signature = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	return `${data}.${signature}`;
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = platform?.env;
	if (!env) {
		throw error(500, 'Platform env not available');
	}

	try {
		const body = (await request.json()) as { email?: string; code?: string };
		const email = body.email?.trim().toLowerCase();
		const code = body.code?.trim();

		if (!email || !code) {
			throw error(400, 'Email and verification code are required.');
		}

		const db = env.DB;

		// Check for brute-force lockout: max 5 wrong attempts per email
		const latestChallenge = await db
			.prepare(
				`SELECT attempts FROM email_verifications 
				 WHERE email = ? AND verified_at IS NULL AND expires_at > datetime('now')
				 ORDER BY created_at DESC LIMIT 1`
			)
			.bind(email)
			.first<{ attempts: number }>();

		if (latestChallenge && latestChallenge.attempts >= 5) {
			throw error(429, 'Too many incorrect attempts. Please request a new verification code.');
		}

		// Check for valid unexpired pending challenge
		const pendingRecord = await db
			.prepare(
				`SELECT id, attempts FROM email_verifications 
				 WHERE email = ? AND otp_code = ? AND expires_at > datetime('now') AND verified_at IS NULL 
				 ORDER BY created_at DESC LIMIT 1`
			)
			.bind(email, code)
			.first<{ id: string; attempts: number }>();

		if (!pendingRecord) {
			// Increment attempts on latest record to prevent brute-forcing
			await db
				.prepare(
					`UPDATE email_verifications 
					 SET attempts = attempts + 1 
					 WHERE email = ? AND verified_at IS NULL`
				)
				.bind(email)
				.run();

			throw error(400, 'Invalid or expired verification code. Please double-check and try again.');
		}

		// Generate signed verification token
		const secret = env.JWT_SECRET;
		if (!secret) {
			throw error(500, 'Server configuration error');
		}
		const verificationToken = await generateSignedToken(email, secret);

		// Mark verified in DB
		await db
			.prepare(
				`UPDATE email_verifications 
				 SET verified_at = datetime('now'), token = ? 
				 WHERE id = ?`
			)
			.bind(verificationToken, pendingRecord.id)
			.run();

		return json({
			success: true,
			verifiedToken: verificationToken,
			message: 'Email successfully verified!'
		});
	} catch (err: any) {
		if (err?.status) throw err;
		console.error('OTP Verify Error:', err);
		throw error(500, err?.message || 'Verification failed.');
	}
};
