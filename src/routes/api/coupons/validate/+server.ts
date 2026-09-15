/**
 * Public Coupon Validation API Endpoint
 * Validates discount codes and computes final consultation fee based on expert pricing.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = platform?.env;
	if (!env?.DB) {
		throw error(500, 'Database not available');
	}

	try {
		const body = (await request.json()) as {
			code?: string;
			eventSlug?: string;
			expertUserId?: string;
			durationMinutes?: number;
		};

		const code = (body.code || '').trim().toUpperCase();
		const eventSlug = (body.eventSlug || '').trim();
		const expertUserId = body.expertUserId?.trim();
		const durationMinutes = Number(body.durationMinutes) || 30;

		if (!code) {
			throw error(400, 'Please enter a coupon code.');
		}

		const db = env.DB;

		// 1. Fetch event type
		const eventType = await db
			.prepare('SELECT id, name, slug, price_inr FROM event_types WHERE slug = ? AND is_active = 1')
			.bind(eventSlug)
			.first<{ id: string; name: string; slug: string; price_inr: number | null }>();

		if (!eventType) {
			throw error(404, 'Consultation service not found.');
		}

		// 2. Fetch expert pricing if expertUserId provided, otherwise fallback to eventType
		let originalPrice = eventType.price_inr || 0;
		if (expertUserId) {
			const expert = await db
				.prepare('SELECT id, session_pricing FROM users WHERE id = ? AND is_active = 1')
				.bind(expertUserId)
				.first<{ id: string; session_pricing: string | null }>();

			if (expert?.session_pricing) {
				try {
					const tiers = JSON.parse(expert.session_pricing) as Array<{ duration: number; price: number }>;
					const matchedTier = tiers.find(t => Number(t.duration) === durationMinutes) || tiers[0];
					if (matchedTier && typeof matchedTier.price === 'number') {
						originalPrice = matchedTier.price;
					}
				} catch (e) {
					console.error('[coupons:validate] Failed to parse expert session_pricing:', e);
				}
			}
		}

		// 3. Lookup coupon
		const coupon = await db
			.prepare(
				`SELECT id, code, discount_type, discount_value, event_type_id, max_uses, used_count, is_active, expires_at
				 FROM coupons
				 WHERE UPPER(code) = ? AND is_active = 1`
			)
			.bind(code)
			.first<{
				id: string;
				code: string;
				discount_type: 'percentage' | 'fixed';
				discount_value: number;
				event_type_id: string | null;
				max_uses: number | null;
				used_count: number;
				is_active: number;
				expires_at: string | null;
			}>();

		if (!coupon) {
			throw error(404, 'Invalid coupon code. Please check and try again.');
		}

		// Check service restriction
		if (coupon.event_type_id && coupon.event_type_id !== eventType.id) {
			throw error(400, 'This coupon is not valid for this specific consultation service.');
		}

		// Check usage limit
		if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
			throw error(400, 'This coupon has reached its maximum usage limit.');
		}

		// Check expiry
		if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
			throw error(400, 'This coupon code has expired.');
		}

		// Calculate discount
		let discountAmount = 0;
		if (coupon.discount_type === 'percentage') {
			discountAmount = Math.round((originalPrice * coupon.discount_value) / 100);
		} else {
			discountAmount = coupon.discount_value;
		}

		discountAmount = Math.min(originalPrice, Math.max(0, discountAmount));
		const finalPrice = Math.max(0, originalPrice - discountAmount);

		return json({
			valid: true,
			code: coupon.code,
			discountType: coupon.discount_type,
			discountValue: coupon.discount_value,
			originalPrice,
			discountAmount,
			finalPrice,
			isComplimentary: finalPrice === 0,
			message: finalPrice === 0
				? '🎉 Coupon applied! 100% Complimentary consultation waiver granted (Total: ₹0).'
				: `🎉 Coupon applied! ₹${discountAmount} discount applied (Total: ₹${finalPrice}).`
		});
	} catch (err: any) {
		console.error('[coupons:validate] Validation error:', err instanceof Error ? err.message : err);
		if (err?.status) throw err;
		throw error(500, err?.message || 'Failed to validate coupon code.');
	}
};
