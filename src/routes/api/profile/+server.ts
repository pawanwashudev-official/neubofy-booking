/**
 * Profile API endpoint
 * Handles expert profile updates: name, role title, bio, public avatar URL,
 * phone, variable session pricing tiers, and calendar settings.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { isValidEmail, validateLength, MAX_LENGTHS } from '$lib/server/validation';

export const PUT: RequestHandler = async (event) => {
	const userId = await getCurrentUser(event);
	if (!userId) {
		throw error(401, 'Unauthorized');
	}

	const env = event.platform?.env;
	if (!env) {
		throw error(500, 'Platform env not available');
	}

	const db = env.DB;

	try {
		const body = (await event.request.json()) as {
			name?: string;
			roleTitle?: string;
			bio?: string;
			phone?: string;
			profileImage?: string | null;
			brandColor?: string | null;
			contactEmail?: string | null;
			timeFormat?: '12h' | '24h';
			sessionPricing?: Array<{ duration: number; price: number; label: string }>;
			isFreeConsultation?: boolean;
			// Global calendar settings
			defaultAvailabilityCalendars?: 'google' | 'outlook' | 'both';
			defaultInviteCalendar?: 'google' | 'outlook';
			selectedGoogleCalendars?: string[];
		};

		const {
			name,
			roleTitle,
			bio,
			phone,
			profileImage,
			brandColor,
			contactEmail,
			timeFormat,
			sessionPricing,
			isFreeConsultation,
			defaultAvailabilityCalendars,
			defaultInviteCalendar,
			selectedGoogleCalendars
		} = body;

		// Get existing user data & settings
		const existingUser = await db
			.prepare('SELECT settings, session_pricing FROM users WHERE id = ?')
			.bind(userId)
			.first<{ settings: string | null; session_pricing: string | null }>();

		let existingSettings: Record<string, unknown> = {};
		try {
			existingSettings = existingUser?.settings ? JSON.parse(existingUser.settings) : {};
		} catch {
			existingSettings = {};
		}

		// Calendar-only update
		if (
			name === undefined &&
			(defaultAvailabilityCalendars !== undefined ||
				defaultInviteCalendar !== undefined ||
				selectedGoogleCalendars !== undefined)
		) {
			const newSettings = {
				...existingSettings,
				defaultAvailabilityCalendars:
					defaultAvailabilityCalendars ?? existingSettings.defaultAvailabilityCalendars ?? 'google',
				defaultInviteCalendar: defaultInviteCalendar ?? existingSettings.defaultInviteCalendar ?? 'google',
				...(selectedGoogleCalendars !== undefined && { selectedGoogleCalendars })
			};

			await db
				.prepare('UPDATE users SET settings = ? WHERE id = ?')
				.bind(JSON.stringify(newSettings), userId)
				.run();

			return json({ success: true });
		}

		if (name !== undefined && name.trim().length === 0) {
			throw error(400, 'Name is required');
		}

		// Validate contact email if provided
		let validContactEmail: string | null = null;
		if (contactEmail) {
			if (!isValidEmail(contactEmail)) {
				throw error(400, 'Invalid contact email address');
			}
			validContactEmail = contactEmail.trim();
		}

		// Validate brand color
		const colorRegex = /^#[0-9A-Fa-f]{6}$/;
		const validBrandColor = brandColor && colorRegex.test(brandColor) ? brandColor : '#3b82f6';

		// Validate session pricing JSON
		let validSessionPricing = existingUser?.session_pricing;
		if (sessionPricing && Array.isArray(sessionPricing)) {
			// Ensure valid duration and price numbers
			const cleanedTiers = sessionPricing.map((tier) => ({
				duration: Math.max(10, Math.min(240, Number(tier.duration) || 30)),
				price: Math.max(0, Number(tier.price) || 0),
				label: tier.label?.trim() || `${tier.duration} Min Consultation`
			}));
			validSessionPricing = JSON.stringify(cleanedTiers);
		}

		// Public image URL validation
		let validProfileImage: string | null = null;
		if (profileImage && typeof profileImage === 'string') {
			const trimmed = profileImage.trim();
			if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
				validProfileImage = trimmed;
			}
		}

		const settings = JSON.stringify({
			...existingSettings,
			timeFormat: timeFormat === '24h' ? '24h' : '12h'
		});

		await db
			.prepare(
				`UPDATE users 
				 SET name = COALESCE(?, name),
				     role_title = ?,
				     bio = ?,
				     phone = ?,
				     profile_image = COALESCE(?, profile_image),
				     brand_color = ?,
				     contact_email = ?,
				     session_pricing = COALESCE(?, session_pricing),
				     is_free_consultation = ?,
				     settings = ?
				 WHERE id = ?`
			)
			.bind(
				name ? name.trim() : null,
				roleTitle ? roleTitle.trim() : 'Technology Consultant',
				bio ? bio.trim() : null,
				phone ? phone.trim() : null,
				validProfileImage,
				validBrandColor,
				validContactEmail,
				validSessionPricing,
				isFreeConsultation !== false ? 1 : 0,
				settings,
				userId
			)
			.run();

		return json({ success: true });
	} catch (err: any) {
		console.error('Profile update error:', err);
		if (err?.status) throw err;
		throw error(500, err?.message || 'Failed to update profile');
	}
};
