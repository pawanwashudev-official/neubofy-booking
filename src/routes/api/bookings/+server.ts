/**
 * Bookings API endpoint
 * Creates verified consultation bookings and adds them to Google Calendar / Meet
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { finalizeConfirmedBooking } from '$lib/server/booking-service';
import { isValidEmail, validateLength, validateFields, MAX_LENGTHS } from '$lib/server/validation';
import { timingSafeEqual } from '$lib/server/auth';

async function verifyOtpToken(token: string, secret: string, email: string): Promise<boolean> {
	try {
		const [data, signature] = token.split('.');
		if (!data || !signature) return false;

		const encoder = new TextEncoder();
		let isValid = false;

		// 1. Check HMAC-SHA256
		try {
			const key = await crypto.subtle.importKey(
				'raw',
				encoder.encode(secret),
				{ name: 'HMAC', hash: 'SHA-256' },
				false,
				['sign']
			);
			const hmacSig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
			const expectedHmac = Array.from(new Uint8Array(hmacSig)).map((b) => b.toString(16).padStart(2, '0')).join('');
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

		if (!isValid) return false;

		const payload = JSON.parse(atob(data));
		if (payload.email?.toLowerCase() !== email.toLowerCase()) return false;

		// Token valid for 30 minutes
		const timestamp = payload.verifiedAt || payload.iat || 0;
		const age = Date.now() - timestamp;
		if (age > 30 * 60 * 1000) return false;

		return true;
	} catch {
		return false;
	}
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = platform?.env;
	if (!env) {
		throw error(500, 'Platform env not available');
	}

	try {
		const body = (await request.json()) as {
			eventSlug: string;
			expertUserId?: string;
			startTime: string;
			endTime: string;
			durationMinutes?: number;
			attendeeName: string;
			attendeeEmail: string;
			attendeePhone?: string;
			goal?: string;
			reason?: string;
			expectations?: string;
			notes?: string;
			couponCode?: string;
			verificationToken?: string;
			turnstileToken?: string;
			timezone?: string;
		};

		const {
			eventSlug,
			expertUserId,
			startTime,
			endTime,
			durationMinutes = 30,
			attendeeName,
			attendeeEmail,
			attendeePhone,
			goal,
			reason,
			expectations,
			notes,
			couponCode,
			verificationToken,
			turnstileToken,
			timezone
		} = body;

		// Validate required fields
		if (!eventSlug || !startTime || !endTime || !attendeeName || !attendeeEmail) {
			throw error(400, 'Missing required fields');
		}

		// Validate email format
		if (!isValidEmail(attendeeEmail)) {
			throw error(400, 'Invalid email address');
		}

		// Email OTP Verification check (mandatory for all bookings)
		const secret = env.JWT_SECRET;
		if (!secret) {
			throw error(500, 'Server configuration error: JWT_SECRET is not set');
		}
		if (!verificationToken) {
			throw error(400, 'Email verification is required. Please verify your email before booking.');
		}
		const isOtpValid = await verifyOtpToken(verificationToken, secret, attendeeEmail);
		if (!isOtpValid) {
			throw error(400, 'Invalid or expired email verification code. Please verify again.');
		}
		const isEmailVerified = 1;

		// Validate input lengths
		const lengthError = validateFields([
			validateLength(attendeeName, 'Name', MAX_LENGTHS.name, true),
			validateLength(attendeeEmail, 'Email', MAX_LENGTHS.email, true),
			validateLength(attendeePhone || '', 'Phone', 30, false),
			validateLength(notes || '', 'Notes', MAX_LENGTHS.notes, false)
		]);
		if (lengthError) {
			throw error(400, lengthError);
		}

		// Verify Cloudflare Turnstile token if configured
		if (turnstileToken && env.TURNSTILE_SECRET_KEY) {
			const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					secret: env.TURNSTILE_SECRET_KEY,
					response: turnstileToken
				})
			});

			const turnstileResult = (await turnstileResponse.json()) as { success: boolean };
			if (!turnstileResult.success) {
				throw error(400, 'Security verification failed');
			}
		}

		const db = env.DB;

		// Get active organization
		const organization = await db
			.prepare('SELECT id, name FROM organizations ORDER BY created_at LIMIT 1')
			.first<{ id: string; name: string }>();

		if (!organization) throw error(404, 'Organization not found');

		// Fetch consultation event type
		const eventType = await db
			.prepare(
				`SELECT id, user_id, name, duration_minutes as duration, description, invite_calendar, is_free_only, price_inr, price_min_inr, price_max_inr 
				 FROM event_types 
				 WHERE slug = ? AND is_active = 1 AND COALESCE(is_deleted, 0) = 0 LIMIT 1`
			)
			.bind(eventSlug)
			.first<{
				id: string;
				user_id: string | null;
				name: string;
				duration: number;
				description: string | null;
				invite_calendar: string | null;
				is_free_only: number;
				price_inr: number | null;
				price_min_inr: number | null;
				price_max_inr: number | null;
			}>();

		if (!eventType) {
			throw error(404, 'Consultation service not found or inactive');
		}

		// Determine target expert user ID deterministically
		let hostUserId = expertUserId;
		if (!hostUserId) {
			const assigned = await db
				.prepare(
					`SELECT etm.user_id 
					 FROM event_type_members etm
					 JOIN users u ON u.id = etm.user_id
					 WHERE etm.event_type_id = ? AND etm.is_active = 1 AND u.is_active = 1 AND COALESCE(u.is_deleted, 0) = 0
					 ORDER BY CASE WHEN u.id = ? THEN 0 ELSE 1 END, etm.created_at ASC, u.name ASC
					 LIMIT 1`
				)
				.bind(eventType.id, eventType.user_id || '')
				.first<{ user_id: string }>();

			hostUserId = assigned?.user_id || eventType.user_id || undefined;
		}

		if (!hostUserId) {
			const fallbackUser = await db
				.prepare('SELECT id FROM users WHERE is_active = 1 AND COALESCE(is_deleted, 0) = 0 ORDER BY created_at ASC LIMIT 1')
				.first<{ id: string }>();
			hostUserId = fallbackUser?.id;
		}

		if (!hostUserId) {
			throw error(404, 'No available consultant found for this service.');
		}

		const user = await db
			.prepare(
				`SELECT id, email, name, slug, contact_email, settings, brand_color, outlook_refresh_token, session_pricing, is_free_consultation 
				 FROM users WHERE id = ? AND is_active = 1 AND COALESCE(is_deleted, 0) = 0`
			)
			.bind(hostUserId)
			.first<{
				id: string;
				email: string;
				name: string;
				slug: string;
				contact_email: string | null;
				settings: string | null;
				brand_color: string | null;
				outlook_refresh_token: string | null;
				session_pricing: any;
				is_free_consultation: number | null;
			}>();

		if (!user) throw error(404, 'Selected consultant not found');

		// Check member-level custom pricing override
		const memberPricing = await db
			.prepare('SELECT custom_pricing FROM event_type_members WHERE event_type_id = ? AND user_id = ? AND is_active = 1 LIMIT 1')
			.bind(eventType.id, user.id)
			.first<{ custom_pricing: string | null }>()
			.catch(() => null);

		// Parse user settings for global calendar defaults
		let userSettings: { defaultInviteCalendar?: string } = {};
		try {
			userSettings = user.settings ? JSON.parse(user.settings) : {};
		} catch {
			userSettings = {};
		}

		let inviteCalendar = eventType.invite_calendar || userSettings.defaultInviteCalendar || 'google';
		if (inviteCalendar === 'outlook' && (!user.outlook_refresh_token || !env.MICROSOFT_CLIENT_ID)) {
			inviteCalendar = 'google';
		}

		// Check for slot conflicts
		const startDateTime = new Date(startTime);
		const endDateTime = new Date(endTime);

		const conflict = await db
			.prepare(
				`SELECT id FROM bookings
				 WHERE user_id = ? AND status = 'confirmed' AND COALESCE(is_deleted, 0) = 0
				 AND (
					(start_time <= ? AND end_time > ?)
					OR (start_time < ? AND end_time >= ?)
					OR (start_time >= ? AND end_time <= ?)
				 )`
			)
			.bind(user.id, startTime, startTime, endTime, endTime, startTime, endTime)
			.first();

		if (conflict) {
			throw error(409, 'This time slot is no longer available. Please select another slot.');
		}

		// ==========================================
		// PRICING WATERFALL COMPUTATION
		// ==========================================
		// 1. Base price resolution: custom member pricing -> expert session pricing -> eventType price
		let basePrice = eventType.price_inr || 0;
		if (memberPricing?.custom_pricing) {
			try {
				const customPackages = typeof memberPricing.custom_pricing === 'string'
					? JSON.parse(memberPricing.custom_pricing)
					: memberPricing.custom_pricing;
				if (Array.isArray(customPackages)) {
					const pkg = customPackages.find((p: any) => Number(p.duration) === Number(durationMinutes));
					if (pkg && typeof pkg.price === 'number') {
						basePrice = pkg.price;
					}
				}
			} catch {}
		} else if (user.session_pricing) {
			try {
				const expertPackages = typeof user.session_pricing === 'string'
					? JSON.parse(user.session_pricing)
					: user.session_pricing;
				if (Array.isArray(expertPackages)) {
					const pkg = expertPackages.find((p: any) => Number(p.duration) === Number(durationMinutes));
					if (pkg && typeof pkg.price === 'number') {
						basePrice = pkg.price;
					}
				}
			} catch {}
		}

		// 2. Free session override (session-level is_free_only or expert is_free_consultation)
		const isComplimentary = Boolean(eventType.is_free_only) || Boolean(user.is_free_consultation);
		let finalPrice = isComplimentary ? 0 : basePrice;
		let discountAmount = 0;
		let validCouponCode: string | null = null;

		// 3. Price Floor & Cap enforcement and Coupon Verification
		const priceFloor = eventType.price_min_inr ?? 0;
		const priceCeiling = eventType.price_max_inr ?? 99999;

		if (!isComplimentary && finalPrice > 0) {
			finalPrice = Math.max(priceFloor, Math.min(finalPrice, priceCeiling));

			if (couponCode?.trim()) {
				const cCode = couponCode.trim().toUpperCase();
				const coupon = await db
					.prepare(
						`SELECT id, code, discount_type, discount_value, event_type_id, max_uses, used_count, expires_at
						 FROM coupons
						 WHERE UPPER(code) = ? AND is_active = 1 AND COALESCE(is_deleted, 0) = 0`
					)
					.bind(cCode)
					.first<{
						id: string;
						code: string;
						discount_type: 'percentage' | 'fixed';
						discount_value: number;
						event_type_id: string | null;
						max_uses: number | null;
						used_count: number;
						expires_at: string | null;
					}>();

				if (!coupon) {
					throw error(400, 'Invalid coupon code.');
				}

				if (coupon.event_type_id && coupon.event_type_id !== eventType.id) {
					throw error(400, 'Coupon is not valid for this consultation service.');
				}

				if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
					throw error(400, 'Coupon has reached its maximum usage limit.');
				}

				if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
					throw error(400, 'Coupon code has expired.');
				}

				if (coupon.discount_type === 'percentage') {
					discountAmount = Math.round((finalPrice * coupon.discount_value) / 100);
				} else {
					discountAmount = coupon.discount_value;
				}

				// Enforce price floor: coupon discount cannot reduce price below priceFloor
				const rawDiscounted = Math.max(0, finalPrice - discountAmount);
				finalPrice = Math.max(priceFloor, rawDiscounted);
				discountAmount = basePrice - finalPrice;
				validCouponCode = coupon.code;

				// Increment coupon usage count
				await db
					.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?')
					.bind(coupon.id)
					.run();
			}
		} else {
			finalPrice = 0;
		}

		// Insert booking record into database
		const bookingId = crypto.randomUUID();
		await db
			.prepare(
				`INSERT INTO bookings (
					id, organization_id, user_id, event_type_id, start_time, end_time, duration_minutes,
					attendee_name, attendee_email, attendee_phone, attendee_notes, goal, reason, expectations,
					price_amount, discount_amount, coupon_code, is_paid, email_verified, status,
					created_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', CURRENT_TIMESTAMP)`
			)
			.bind(
				bookingId,
				organization.id,
				user.id,
				eventType.id,
				startTime,
				endTime,
				durationMinutes,
				attendeeName,
				attendeeEmail,
				attendeePhone || null,
				notes || null,
				goal || null,
				reason || null,
				expectations || null,
				finalPrice,
				discountAmount,
				validCouponCode,
				finalPrice === 0 ? 1 : 0, // is_paid: 1 for free/waived, 0 for pending payment
				isEmailVerified
			)
			.run();

		// Invalidate availability cache for this date
		try {
			const dateStr = startDateTime.toISOString().split('T')[0];
			const prefix = `availability:${eventSlug}:${user.id}:`;
			const listed = await env.KV?.list({ prefix });
			if (listed?.keys) {
				const keysToDelete = listed.keys.filter((k) => k.name.endsWith(`:${dateStr}`));
				await Promise.all(keysToDelete.map((k) => env.KV?.delete(k.name)));
			}
		} catch {}

		// If booking requires payment: redirect to interim UPI payment page
		if (finalPrice > 0) {
			return json({
				success: true,
				bookingId,
				requiresPayment: true,
				paymentUrl: `/payment/${bookingId}`,
				amountDue: finalPrice,
				expertName: user.name,
				serviceName: eventType.name,
				startTime,
				endTime
			});
		}

		// Otherwise, for free/complimentary consultations, provision calendar and send emails immediately
		const finalResult = await finalizeConfirmedBooking(db, env, bookingId);

		return json({
			success: true,
			bookingId,
			requiresPayment: false,
			meetingUrl: finalResult.meetingUrl,
			meetingType: inviteCalendar === 'outlook' ? 'teams' : 'google_meet',
			expertName: user.name,
			serviceName: eventType.name,
			startTime,
			endTime
		});
	} catch (err: any) {
		console.error('Booking creation error:', err);
		// Retain deliberate 4xx client errors
		if (err?.status && err.status < 500) {
			throw err;
		}
		// Never leak raw database SQL errors to the public client
		throw error(500, 'Unable to schedule consultation at this moment. Please try again or contact our support team.');
	}
};
