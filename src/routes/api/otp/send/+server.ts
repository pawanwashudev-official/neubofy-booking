/**
 * OTP Send API endpoint
 * Generates and sends a 6-digit verification code to the client's email before booking.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isValidEmail } from '$lib/server/validation';
import { getSenderEmail, getReplyToEmail } from '$lib/server/email';

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = platform?.env;
	if (!env) {
		throw error(500, 'Platform env not available');
	}

	try {
		const body = (await request.json()) as { email?: string };
		const email = body.email?.trim().toLowerCase();

		if (!email || !isValidEmail(email)) {
			throw error(400, 'Please provide a valid email address.');
		}

		const db = env.DB;

		// Check rate limiting: max 3 OTP requests in the last 5 minutes
		const recentRequests = await db
			.prepare(
				`SELECT count(*) as count FROM email_verifications 
				 WHERE email = ? AND created_at > datetime('now', '-5 minutes')`
			)
			.bind(email)
			.first<{ count: number }>();

		if (recentRequests && recentRequests.count >= 4) {
			throw error(429, 'Too many verification attempts. Please wait a few minutes before trying again.');
		}

		// Generate cryptographically secure 6-digit OTP
		const array = new Uint32Array(1);
		crypto.getRandomValues(array);
		const otpCode = String(100000 + (array[0] % 900000));

		// Set 10-minute expiry
		const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

		await db
			.prepare(
				`INSERT INTO email_verifications (email, otp_code, expires_at, created_at)
				 VALUES (?, ?, ?, datetime('now'))`
			)
			.bind(email, otpCode, expiresAt)
			.run();

		// Compose branded Neubofy email
		const html = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<style>
		body { margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5; }
		.container { max-width: 520px; margin: 40px auto; background: #121215; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; overflow: hidden; }
		.header { padding: 32px 28px 24px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: radial-gradient(circle at top, rgba(59, 130, 246, 0.15), transparent 70%); }
		.brand { font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px; }
		.badge { display: inline-block; margin-top: 8px; padding: 4px 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; border-radius: 9999px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
		.content { padding: 32px 28px; text-align: center; }
		.title { font-size: 22px; font-weight: 600; color: #ffffff; margin-bottom: 8px; }
		.subtitle { font-size: 14px; color: #a1a1aa; line-height: 1.6; margin-bottom: 28px; }
		.otp-box { display: inline-block; padding: 18px 36px; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #ffffff; background: #18181b; border: 1px solid #3b82f6; border-radius: 12px; box-shadow: 0 0 20px rgba(59, 130, 246, 0.25); margin-bottom: 24px; }
		.notice { font-size: 13px; color: #71717a; line-height: 1.5; }
		.footer { padding: 20px; text-align: center; font-size: 12px; color: #52525b; border-top: 1px solid rgba(255, 255, 255, 0.05); }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<div class="brand">Neubofy™</div>
			<div class="badge">Technology Consultation</div>
		</div>
		<div class="content">
			<div class="title">Verification Code</div>
			<div class="subtitle">Please enter this 6-digit code to verify your email address and confirm your consultation booking.</div>
			<div class="otp-box">${otpCode}</div>
			<div class="notice">This verification code expires in <strong>10 minutes</strong>. If you did not request this consultation, you can safely ignore this email.</div>
		</div>
		<div class="footer">
			&copy; Neubofy &bull; Your Technology Department, Without Building One &bull; neubofy.in
		</div>
	</div>
</body>
</html>`;

		// Attempt sending email via Resend if API key available
		const emailApiKey = env.RESEND_API_KEY;
		const emailFrom = env.EMAIL_FROM || 'booking@updates.neubofy.in';

		if (emailApiKey) {
			try {
				await fetch('https://api.resend.com/emails', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${emailApiKey}`
					},
					body: JSON.stringify({
						from: getSenderEmail('otp', env.EMAIL_FROM),
						to: email,
						reply_to: getReplyToEmail('otp', env.EMAIL_REPLY_TO),
						subject: `${otpCode} is your Neubofy consultation verification code`,
						html
					})
				});
			} catch (mailErr) {
				console.error('Failed to send OTP email via provider:', mailErr);
			}
		} else {
			console.warn(`[OTP] Email API not configured — OTP for ${email.substring(0, 3)}*** was generated but could not be sent.`);
		}

		return json({
			success: true,
			message: 'Verification code sent to your email.'
		});
	} catch (err: any) {
		if (err?.status) throw err;
		console.error('OTP Send Error:', err);
		throw error(500, err?.message || 'Failed to send verification code.');
	}
};
