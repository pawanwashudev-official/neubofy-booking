/**
 * Edit event type
 */

import { redirect, fail, error } from '@sveltejs/kit';
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
		throw error(500, 'Database not available');
	}

	const eventTypeId = event.params.id;

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

	// Get event type
	const eventType = await db
		.prepare(
			`SELECT id, name, slug, duration_minutes as duration, description, is_active, cover_image,
				availability_calendars, invite_calendar
			FROM event_types
			WHERE id = ? AND organization_id = ? AND EXISTS (
				SELECT 1 FROM event_type_hosts h
				WHERE h.event_type_id = event_types.id AND h.user_id = ? AND h.is_active = 1
			)`
		)
		.bind(eventTypeId, auth.organizationId, auth.userId)
		.first<{
			id: string;
			name: string;
			slug: string;
			duration: number;
			description: string;
			is_active: number;
			cover_image: string | null;
			availability_calendars: string | null;
			invite_calendar: string | null;
		}>();

	if (!eventType) {
		throw error(404, 'Event type not found');
	}

	const assignedExperts = await db.prepare(
		`SELECT u.id, u.name, u.profile_image, u.public_title
		 FROM event_type_hosts h JOIN users u ON u.id = h.user_id
		 WHERE h.event_type_id = ? AND h.is_active = 1 ORDER BY u.name`
	).bind(eventTypeId).all();
	const organizationExperts = isOrganizationAdmin(auth.role)
		? (await db.prepare(
			`SELECT u.id, u.name, u.profile_image, u.public_title
			 FROM organization_members om JOIN users u ON u.id = om.user_id
			 WHERE om.organization_id = ? AND om.is_active = 1 AND u.is_active = 1 ORDER BY u.name`
		).bind(auth.organizationId).all()).results
		: [];

	return {
		eventType,
		assignedExperts: assignedExperts.results,
		organizationExperts,
		canManageExperts: isOrganizationAdmin(auth.role),
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

		const eventTypeId = event.params.id;

		// Verify ownership
		const existing = await db
			.prepare(
				`SELECT id FROM event_types
				 WHERE id = ? AND organization_id = ? AND EXISTS (
					SELECT 1 FROM event_type_hosts h WHERE h.event_type_id = event_types.id AND h.user_id = ? AND h.is_active = 1
				 )`
			)
			.bind(eventTypeId, auth.organizationId, auth.userId)
			.first();

		if (!existing) {
			return fail(404, { error: 'Event type not found' });
		}

		const formData = await event.request.formData();
		const requestedExpertIds = formData.getAll('expert_ids').map(value => value.toString()).filter(Boolean);
		const name = formData.get('name');
		const slug = formData.get('slug');
		const duration = formData.get('duration');
		const description = formData.get('description') || '';
		const isActive = formData.get('is_active') === 'on';
		const coverImage = formData.get('cover_image') || null;
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
			return fail(400, {
				error: 'Slug can only contain lowercase letters, numbers, and hyphens'
			});
		}

		try {
			// Check if slug already exists for this user (excluding current event type)
			const slugExists = await db
				.prepare('SELECT id FROM event_types WHERE user_id = ? AND slug = ? AND id != ?')
				.bind(userId, slugStr, eventTypeId)
				.first();

			if (slugExists) {
				return fail(400, { error: 'An event type with this slug already exists' });
			}

			// Update event type
			await db
				.prepare(
					`UPDATE event_types
					SET name = ?, slug = ?, duration_minutes = ?, description = ?, is_active = ?, cover_image = ?,
						availability_calendars = ?, invite_calendar = ?
					WHERE id = ? AND organization_id = ?`
				)
				.bind(
					name.toString(),
					slugStr,
					parseInt(duration.toString()),
					description.toString(),
					isActive ? 1 : 0,
					coverImage ? coverImage.toString() : null,
					availabilityCalendars ? availabilityCalendars.toString() : null,
					inviteCalendar ? inviteCalendar.toString() : null,
					eventTypeId,
					auth.organizationId
				)
				.run();

			if (isOrganizationAdmin(auth.role) && requestedExpertIds.length > 0) {
				const expertIds = new Set(requestedExpertIds);
				const placeholders = Array.from(expertIds, () => '?').join(', ');
				const validExperts = await db.prepare(
					`SELECT user_id FROM organization_members WHERE organization_id = ? AND is_active = 1 AND user_id IN (${placeholders})`
				).bind(auth.organizationId, ...expertIds).all<{ user_id: string }>();
				if (validExperts.results.length !== expertIds.size) return fail(400, { error: 'Every selected expert must be an active organization member' });
				await db.prepare('UPDATE event_type_hosts SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE event_type_id = ?').bind(eventTypeId).run();
				await db.batch(Array.from(expertIds, expertId => db.prepare(
					`INSERT INTO event_type_hosts (event_type_id, organization_id, user_id, is_active, updated_at)
					 VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
					 ON CONFLICT(event_type_id, user_id) DO UPDATE SET is_active = 1, updated_at = CURRENT_TIMESTAMP`
				).bind(eventTypeId, auth.organizationId, expertId)));
			}

			throw redirect(302, '/dashboard');
		} catch (error: any) {
			if (error?.status === 302) throw error; // Re-throw redirects
			console.error('Error updating event type:', error);
			return fail(500, { error: 'Failed to update event type' });
		}
	}
};
