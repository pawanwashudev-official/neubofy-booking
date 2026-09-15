/**
 * Reusable Email Identity Verification System for Neubofy
 * Handles OTP creation, validation, disposable email blocking,
 * secure token signing/verification, and identity confirmation for
 * bookings, cancellations, and reschedules.
 */

import { isValidEmail } from '$lib/server/validation';
import { timingSafeEqual } from '$lib/server/auth';
import { getSenderEmail, getReplyToEmail } from '$lib/server/email';

// Comprehensive set of known disposable / temporary email providers
const DISPOSABLE_EMAIL_DOMAINS = new Set([
	'mailinator.com',
	'guerrillamail.com',
	'guerrillamail.net',
	'guerrillamail.biz',
	'guerrillamail.org',
	'sharklasers.com',
	'grr.la',
	'tempmail.com',
	'temp-mail.org',
	'tempmail.net',
	'10minutemail.com',
	'10minutemail.net',
	'10minutemail.org',
	'throwawaymail.com',
	'trashmail.com',
	'trashmail.net',
	'trashmail.me',
	'trashmail.io',
	'yopmail.com',
	'yopmail.fr',
	'yopmail.net',
	'dispostable.com',
	'fakeinbox.com',
	'getnada.com',
	'nada.ltd',
	'emailondeck.com',
	'mohmal.com',
	'burnermail.io',
	'dropmail.me',
	'crazymailing.com',
	'mailnesia.com',
	'getairmail.com',
	'mytemp.email',
	'fakemailgenerator.com',
	'inboxbear.com',
	'throwawayemailaddress.com',
	'generator.email',
	'mailcatch.com',
	'trashmail.org',
	'mailsac.com',
	'discard.email',
	'discardmail.com',
	'spambog.com',
	'tempr.email',
	'maildrop.cc',
	'harakirimail.com',
	'incognitomail.org',
	'minuteinbox.com',
	'guerrillamailblock.com',
	'pokemail.net',
	'spam4.me',
	'zillamail.com',
	'tempmailaddress.com',
	'mailnull.com',
	'mytempmail.com',
	'owlymail.com',
	'inboxkitten.com',
	'burneremail.net',
	'bupmail.com',
	'temporarymail.com',
	'temporaryemail.net',
	'tmail.io',
	'luxusmail.org',
	'crazymailing.org',
	'emailfake.com',
	'emltmp.com',
	'generator-email.com',
	'mohmal.im',
	'mohmal.in',
	'internxt.com',
	'protonmail.com.de',
	'receiveemail.org',
	'safeinbox.xyz',
	't-mail.org',
	'tempmailgen.com',
	'tmpmail.net',
	'tmpmail.org',
	'vmani.com',
	'trashmail.ws'
]);

export interface EmailAcceptanceResult {
	valid: boolean;
	reason?: string;
	isGoogleMail?: boolean;
	warning?: string;
}

/**
 * Validates email format, blocks disposable domains,
 * and detects Google accounts for Google Meet compatibility.
 */
export function isAcceptableEmail(email: string): EmailAcceptanceResult {
	if (!email || !isValidEmail(email)) {
		return { valid: false, reason: 'Please enter a valid email address.' };
	}

	const normalized = email.trim().toLowerCase();
	const parts = normalized.split('@');
	if (parts.length !== 2) {
		return { valid: false, reason: 'Malformed email address.' };
	}

	const domain = parts[1];

	// Check against disposable email blacklist
	if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
		return {
			valid: false,
			reason: 'Temporary or disposable email addresses are not permitted. Please use your official or business email.'
		};
	}

	const isGoogleMail = domain === 'gmail.com' || domain === 'googlemail.com';

	return {
		valid: true,
		isGoogleMail,
		warning: isGoogleMail
			? undefined
			: 'If this consultation uses Google Meet, please ensure you can join from this email address.'
	};
}

/**
 * Mask an email address to protect privacy (e.g. p***n@example.com)
 */
export function maskEmail(email: string): string {
	if (!email || !email.includes('@')) return '***@***.***';
	const [local, domain] = email.split('@');
	if (local.length <= 2) {
		return `${local[0]}***@${domain}`;
	}
	const first = local[0];
	const last = local[local.length - 1];
	return `${first}***${last}@${domain}`;
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
 * Generate a cryptographically signed verification token for an email address
 */
export async function generateVerificationToken(
	email: string,
	secret: string,
	purpose: string = 'booking'
): Promise<string> {
	const payload = {
		email: email.trim().toLowerCase(),
		verifiedAt: Date.now(),
		purpose
	};
	const data = btoa(JSON.stringify(payload));
	const signature = await signHmac(data, secret);
	return `${data}.${signature}`;
}

/**
 * Verify a signed verification token (supports HMAC-SHA256 and legacy hash fallback)
 */
export async function verifyVerificationToken(
	token: string,
	secret: string,
	expectedEmail?: string,
	purpose?: string
): Promise<{ valid: boolean; email?: string }> {
	try {
		const parts = token.split('.');
		if (parts.length !== 2) return { valid: false };
		const [data, signature] = parts;

		const encoder = new TextEncoder();
		let isValid = false;

		// 1. HMAC-SHA256 verification
		try {
			const expectedHmac = await signHmac(data, secret);
			isValid = timingSafeEqual(signature, expectedHmac);
		} catch {}

		// 2. Legacy fallback
		if (!isValid) {
			const keyData = encoder.encode(`${data}.${secret}`);
			const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
			const hashArray = Array.from(new Uint8Array(hashBuffer));
			const expectedLegacy = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
			isValid = timingSafeEqual(signature, expectedLegacy);
		}

		if (!isValid) return { valid: false };

		const payload = JSON.parse(atob(data));
		const email = payload.email?.toLowerCase();

		if (expectedEmail && email !== expectedEmail.toLowerCase()) {
			return { valid: false };
		}

		if (purpose && payload.purpose && payload.purpose !== purpose) {
			return { valid: false };
		}

		// Token valid for 30 minutes
		const timestamp = payload.verifiedAt || payload.iat || 0;
		if (Date.now() - timestamp > 30 * 60 * 1000) {
			return { valid: false };
		}

		return { valid: true, email };
	} catch {
		return { valid: false };
	}
}

/**
 * Create a new OTP code in database with rate limiting
 */
export async function createVerificationOtp(
	db: D1Database,
	email: string
): Promise<{ success: boolean; otpCode?: string; error?: string; status?: number }> {
	const normalizedEmail = email.trim().toLowerCase();

	// Check rate limiting: max 4 OTP requests in the last 5 minutes
	const recentRequests = await db
		.prepare(
			`SELECT count(*) as count FROM email_verifications 
			 WHERE email = ? AND created_at > datetime('now', '-5 minutes')`
		)
		.bind(normalizedEmail)
		.first<{ count: number }>();

	if (recentRequests && recentRequests.count >= 4) {
		return {
			success: false,
			error: 'Too many verification attempts. Please wait 5 minutes before trying again.',
			status: 429
		};
	}

	// Generate cryptographically secure 6-digit OTP
	const array = new Uint32Array(1);
	crypto.getRandomValues(array);
	const otpCode = String(100000 + (array[0] % 900000));

	// 10-minute expiry
	const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

	await db
		.prepare(
			`INSERT INTO email_verifications (email, otp_code, expires_at, created_at)
			 VALUES (?, ?, ?, datetime('now'))`
		)
		.bind(normalizedEmail, otpCode, expiresAt)
		.run();

	return { success: true, otpCode };
}

/**
 * Verify OTP code entered by the user
 */
export async function verifyOtpCode(
	db: D1Database,
	email: string,
	code: string,
	secret: string,
	purpose: string = 'booking'
): Promise<{ success: boolean; token?: string; error?: string; status?: number }> {
	const normalizedEmail = email.trim().toLowerCase();
	const trimmedCode = code.trim();

	// Lockout check: max 5 wrong attempts per email
	const latestChallenge = await db
		.prepare(
			`SELECT attempts FROM email_verifications 
			 WHERE email = ? AND verified_at IS NULL AND expires_at > datetime('now')
			 ORDER BY created_at DESC LIMIT 1`
		)
		.bind(normalizedEmail)
		.first<{ attempts: number }>();

	if (latestChallenge && latestChallenge.attempts >= 5) {
		return {
			success: false,
			error: 'Too many incorrect attempts. Please request a new verification code.',
			status: 429
		};
	}

	// Fetch active pending challenge
	const pendingRecord = await db
		.prepare(
			`SELECT id, attempts, otp_code FROM email_verifications 
			 WHERE email = ? AND expires_at > datetime('now') AND verified_at IS NULL 
			 ORDER BY created_at DESC LIMIT 1`
		)
		.bind(normalizedEmail)
		.first<{ id: string; attempts: number; otp_code: string }>();

	if (!pendingRecord || !timingSafeEqual(pendingRecord.otp_code, trimmedCode)) {
		// Increment attempts on latest unverified record
		await db
			.prepare(
				`UPDATE email_verifications 
				 SET attempts = attempts + 1 
				 WHERE email = ? AND verified_at IS NULL`
			)
			.bind(normalizedEmail)
			.run();

		return {
			success: false,
			error: 'Invalid or expired verification code. Please double-check and try again.',
			status: 400
		};
	}

	// Generate signed verification token
	const token = await generateVerificationToken(normalizedEmail, secret, purpose);

	// Mark verified in DB
	await db
		.prepare(
			`UPDATE email_verifications 
			 SET verified_at = datetime('now'), token = ? 
			 WHERE id = ?`
		)
		.bind(token, pendingRecord.id)
		.run();

	return { success: true, token };
}

/**
 * Send branded Neubofy verification email via Resend
 */
export async function sendVerificationEmail(
	email: string,
	otpCode: string,
	env: any,
	purpose: 'booking' | 'cancel' | 'reschedule' = 'booking'
): Promise<void> {
	const purposeConfig = {
		booking: {
			title: 'Verification Code',
			subtitle: 'Please enter this 6-digit code to verify your email and confirm your consultation booking.',
			subject: `${otpCode} is your consultation booking verification code`
		},
		cancel: {
			title: 'Cancellation Verification',
			subtitle: 'Please enter this 6-digit code to verify your identity and cancel your scheduled consultation.',
			subject: `${otpCode} is your consultation cancellation code`
		},
		reschedule: {
			title: 'Reschedule Verification',
			subtitle: 'Please enter this 6-digit code to verify your identity and reschedule your consultation.',
			subject: `${otpCode} is your consultation rescheduling code`
		}
	}[purpose];

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
			<div class="title">${purposeConfig.title}</div>
			<div class="subtitle">${purposeConfig.subtitle}</div>
			<div class="otp-box">${otpCode}</div>
			<div class="notice">This code expires in <strong>10 minutes</strong>. If you did not request this, you can safely ignore this email.</div>
		</div>
		<div class="footer">
			&copy; Neubofy &bull; Your Technology Department, Without Building One &bull; neubofy.in
		</div>
	</div>
</body>
</html>`;

	const emailApiKey = env.RESEND_API_KEY;
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
					subject: purposeConfig.subject,
					html
				})
			});
		} catch (mailErr) {
			console.error('Failed to send verification email:', mailErr);
		}
	} else {
		console.warn(`[Verification OTP] Provider not configured — code for ${email.substring(0, 3)}*** was generated.`);
	}
}
