/**
 * Public Coupon Validation API Endpoint
 * Validates discount codes and computes final consultation fee.
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
		};

		const code = (body.code || '').trim().toUpperCase();
		const eventSlug = (body.eventSlug || '').trim();

		if (!code) {
			throw error(400, 'Please enter a coupon code.');
		}

		const db = env.DB;

		// 1. Fetch event type to determine base price & complimentary status
		const eventType = await db
			.prepare('SELECT id, name, slug, is_free_only, price_inr FROM event_types WHERE slug = ? AND is_active = 1')
			.bind(eventSlug)
			.first<{ id: string; name: string; slug: string; is_free_only: number; price_inr: number | null }>();

		if (!eventType) {
			throw error(404, 'Consultation service not found.');
		}

		const originalPrice = eventType.is_free_only ? 0 : (eventType.price_inr || 0);

		// If consultation is already complimentary
		if (eventType.is_free_only || originalPrice === 0) {
			return json({
				valid: true,
				code,
				message: 'This consultation is already complimentary (100% Free)!',
				discountType: 'percentage',
				discountValue: 100,
				originalPrice: 0,
				discountAmount: 0,
				finalPrice: 0,
				isComplimentary: true
			});
		}

		// 2. Lookup coupon
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
				? '🎉 Coupon applied! 100% Complimentary consultation waiver granted.'
				: `🎉 Coupon applied! ₹${discountAmount} discount applied.`
		});
	} catch (err: any) {
		console.error('Coupon validation error:', err);
		if (err?.status) throw err;
		throw error(500, err?.message || 'Failed to validate coupon code.');
	}
};
