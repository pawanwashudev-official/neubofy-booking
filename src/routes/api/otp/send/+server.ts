/**
 * OTP Send API endpoint
 * Validates acceptable email addresses (blocking disposable domains),
 * creates a 6-digit OTP, and dispatches a Neubofy-branded verification email.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	isAcceptableEmail,
	createVerificationOtp,
	sendVerificationEmail
} from '$lib/server/email-verification';

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = platform?.env;
	if (!env) {
		throw error(500, 'Platform env not available');
	}

	try {
		const body = (await request.json()) as {
			email?: string;
			purpose?: 'booking' | 'cancel' | 'reschedule';
		};
		const email = body.email?.trim().toLowerCase();
		const purpose = body.purpose || 'booking';

		if (!email) {
			throw error(400, 'Please provide an email address.');
		}

		// Validate email syntax and block disposable / temporary email domains
		const emailCheck = isAcceptableEmail(email);
		if (!emailCheck.valid) {
			throw error(400, emailCheck.reason || 'Invalid email address provided.');
		}

		const db = env.DB;
		const otpResult = await createVerificationOtp(db, email);
		if (!otpResult.success || !otpResult.otpCode) {
			throw error(otpResult.status || 500, otpResult.error || 'Failed to generate verification code.');
		}

		// Send verification email via provider
		await sendVerificationEmail(email, otpResult.otpCode, env, purpose);

		return json({
			success: true,
			message: 'Verification code sent to your email.',
			warning: emailCheck.warning
		});
	} catch (err: any) {
		if (err?.status) throw err;
		console.error('OTP Send Error:', err);
		throw error(500, err?.message || 'Failed to send verification code.');
	}
};
