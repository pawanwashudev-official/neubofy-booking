/**
 * Create new event type
 */

import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getAuthContext, isOrganizationAdmin } from '$lib/server/auth';
import { validateLength, validateFields, MAX_LENGTHS } from '$lib/server/validation';

export const load: PageServerLoad = async (event) => {
	const auth = await getAuthContext(event);

	if (!auth) {
		throw redirect(302, '/auth/login');
	}

	const db = event.platform?.env?.DB;
	if (!db) {
		return {
			googleConnected: false,
			outlookConnected: false,
			outlookConfigured: false,
			defaultAvailabilityCalendars: undefined,
			defaultInviteCalendar: undefined
		};
	}

	// Get user info for calendar connection status and settings
	const user = await db
		.prepare('SELECT google_refresh_token, outlook_refresh_token, settings FROM users WHERE id = ?')
		.bind(auth.userId)
		.first<{ google_refresh_token: string | null; outlook_refresh_token: string | null; settings: string | null }>();

	// Check if Microsoft OAuth is configured
	const outlookConfigured = !!(event.platform?.env?.MICROSOFT_CLIENT_ID && event.platform?.env?.MICROSOFT_CLIENT_SECRET);

	// Parse user settings for global calendar defaults
	let userSettings: {
		defaultAvailabilityCalendars?: 'google' | 'outlook' | 'both';
		defaultInviteCalendar?: 'google' | 'outlook';
	} = {};
	try {
		userSettings = user?.settings ? JSON.parse(user.settings) : {};
	} catch {
		userSettings = {};
	}

	return {
		experts: isOrganizationAdmin(auth.role)
			? (await db.prepare(
				`SELECT u.id, u.name, u.profile_image, u.public_title, u.public_profile_enabled
				 FROM organization_members om JOIN users u ON u.id = om.user_id
				 WHERE om.organization_id = ? AND om.is_active = 1 AND u.is_active = 1
				 ORDER BY u.name`
			).bind(auth.organizationId).all()).results
			: [],
		currentUserId: auth.userId,
		role: auth.role,
		googleConnected: !!user?.google_refresh_token,
		outlookConnected: !!user?.outlook_refresh_token,
		outlookConfigured,
		defaultAvailabilityCalendars: userSettings.defaultAvailabilityCalendars,
		defaultInviteCalendar: userSettings.defaultInviteCalendar
	};
};

export const actions: Actions = {
	default: async (event) => {
		const auth = await getAuthContext(event);

		if (!auth) {
			throw redirect(302, '/auth/login');
		}

		const db = event.platform?.env?.DB;
		if (!db) {
			return fail(500, { error: 'Database not available' });
		}

		const formData = await event.request.formData();
		const requestedExpertIds = formData.getAll('expert_ids').map(value => value.toString()).filter(Boolean);
		const name = formData.get('name');
		const slug = formData.get('slug');
		const duration = formData.get('duration');
		const description = formData.get('description') || '';
		const isActive = formData.get('is_active') === 'on';
		const coverImage = formData.get('cover_image') || '';
		const overrideCalendarSettings = formData.get('override_calendar_settings') === 'on';
		// Only use custom values if override is enabled, otherwise null (use global)
		const availabilityCalendars = overrideCalendarSettings ? (formData.get('availability_calendars') || 'both') : null;
		const inviteCalendar = overrideCalendarSettings ? (formData.get('invite_calendar') || 'google') : null;

		if (!name || !slug || !duration) {
			return fail(400, { error: 'Missing required fields' });
		}

		// Validate input lengths
		const lengthError = validateFields([
			validateLength(name.toString(), 'Name', MAX_LENGTHS.name, true),
			validateLength(slug.toString(), 'Slug', MAX_LENGTHS.slug, true),
			validateLength(description.toString(), 'Description', MAX_LENGTHS.description, false)
		]);
		if (lengthError) {
			return fail(400, { error: lengthError });
		}

		// Validate slug is URL-safe
		const slugStr = slug.toString().toLowerCase();
		if (!/^[a-z0-9-]+$/.test(slugStr)) {
			return fail(400, { error: 'Slug can only contain lowercase letters, numbers, and hyphens' });
		}

		try {
			// Public event slugs are organization-scoped.
			const existing = await db
				.prepare('SELECT id FROM event_types WHERE organization_id = ? AND slug = ?')
				.bind(auth.organizationId, slugStr)
				.first();

			if (existing) {
				return fail(400, { error: 'An event type with this slug already exists' });
			}

			const expertIds = new Set([auth.userId, ...(isOrganizationAdmin(auth.role) ? requestedExpertIds : [])]);
			const placeholders = Array.from(expertIds, () => '?').join(', ');
			const experts = await db.prepare(
				`SELECT user_id FROM organization_members
				 WHERE organization_id = ? AND is_active = 1 AND user_id IN (${placeholders})`
			).bind(auth.organizationId, ...expertIds).all<{ user_id: string }>();
			if (experts.results.length !== expertIds.size) {
				return fail(400, { error: 'Every selected expert must be an active member of this organization' });
			}

			const eventId = crypto.randomUUID();
			await db
				.prepare(
					`INSERT INTO event_types (id, user_id, organization_id, name, slug, duration_minutes, description, is_active, cover_image, availability_calendars, invite_calendar, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
				)
				.bind(eventId, auth.userId, auth.organizationId, name, slugStr, parseInt(duration.toString()), description, isActive ? 1 : 0, coverImage, availabilityCalendars, inviteCalendar)
				.run();
			await db.batch(Array.from(expertIds, expertId => db.prepare(
				'INSERT INTO event_type_hosts (event_type_id, organization_id, user_id) VALUES (?, ?, ?)'
			).bind(eventId, auth.organizationId, expertId)));

			throw redirect(302, '/dashboard');
		} catch (error: any) {
			if (error?.status === 302) throw error; // Re-throw redirects
			console.error('Error creating event type:', error);
			return fail(500, { error: 'Failed to create event type' });
		}
	}
};
