/**
 * Booking page for a specific organization event type.
 * Returns event details, pricing, and all assigned expert specialists.
 */

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, platform, url }) => {
	const env = platform?.env;
	if (!env) {
		throw error(500, 'Platform env not available');
	}

	const db = env.DB;

	try {
		const organization = await db
			.prepare('SELECT id, slug, name, profile_image, brand_color, contact_email FROM organizations ORDER BY created_at LIMIT 1')
			.first<{ id: string; slug: string; name: string; profile_image: string | null; brand_color: string | null; contact_email: string | null }>();

		if (!organization) throw error(404, 'Organization not found');

		let eventType: any = null;
		try {
			eventType = await db
				.prepare(
					`SELECT et.id, et.slug, et.name, et.duration_minutes as duration, et.durations_json,
						et.description, et.is_active, et.cover_image, et.invite_calendar, et.user_id as host_user_id,
						et.price_inr, et.category,
						u.name as host_name, u.email as host_email, u.settings as host_settings
					 FROM event_types et
					 LEFT JOIN users u ON u.id = et.user_id
					 WHERE (et.organization_id = ? OR et.organization_id IS NULL OR et.organization_id = 'org_neubofy_main')
					   AND et.slug = ?
					   AND COALESCE(et.is_active, 1) = 1`
				)
				.bind(organization.id, params.slug)
				.first();
		} catch {
			try {
				eventType = await db
					.prepare(
						`SELECT et.id, et.slug, et.name, et.duration_minutes as duration,
							et.description, et.is_active, et.cover_image, et.invite_calendar, et.user_id as host_user_id,
							u.name as host_name, u.email as host_email, u.settings as host_settings
						 FROM event_types et
						 LEFT JOIN users u ON u.id = et.user_id
						 WHERE (et.organization_id = ? OR et.organization_id IS NULL OR et.organization_id = 'org_neubofy_main')
						   AND et.slug = ?
						   AND COALESCE(et.is_active, 1) = 1`
					)
					.bind(organization.id, params.slug)
					.first();
				if (eventType) {
					eventType.price_inr = 0;
					eventType.category = 'Consultation';
					eventType.durations_json = `[${eventType.duration || 30}]`;
				}
			} catch (e2) {
				console.error('[slug:load] Failed to query eventType:', e2);
			}
		}

		if (!eventType) throw error(404, 'Event type not found or inactive');

		// Fetch all assigned active specialists for this consultation service (deterministic order)
		let assignedExperts: any[] = [];
		try {
			const membersResult = await db
				.prepare(
					`SELECT u.id, u.name, u.email, u.slug, u.profile_image, u.role_title, u.bio,
					        u.session_pricing, u.brand_color, u.timezone
					 FROM event_type_members etm
					 JOIN users u ON u.id = etm.user_id
					 WHERE etm.event_type_id = ? AND etm.is_active = 1
					 ORDER BY CASE WHEN u.id = ? THEN 0 ELSE 1 END, etm.created_at ASC, u.name ASC`
				)
				.bind(eventType.id, eventType.host_user_id || '')
				.all();

			assignedExperts = ((membersResult.results as any[]) || []).map((exp) => {
				let parsedPricing = [];
				try {
					parsedPricing = exp.session_pricing ? JSON.parse(exp.session_pricing) : [];
				} catch (errPricing) {
					console.warn('[slug:load] Failed to parse expert pricing:', errPricing);
				}
				return {
					...exp,
					session_pricing: parsedPricing
				};
			});
		} catch (errMembers) {
			console.warn('event_type_members query bypassed or failed:', errMembers);
		}

		// Fallback to legacy creator user if no junction entries exist
		if (assignedExperts.length === 0 && eventType.host_user_id) {
			try {
				const creator = await db
					.prepare('SELECT id, name, email, slug, profile_image, role_title, bio, session_pricing, brand_color, timezone FROM users WHERE id = ?')
					.bind(eventType.host_user_id)
					.first<any>();

				if (creator) {
					let parsedPricing = [];
					try {
						parsedPricing = creator.session_pricing ? JSON.parse(creator.session_pricing) : [];
					} catch (errCreatorPricing) {
						console.warn('[slug:load] Failed to parse creator pricing:', errCreatorPricing);
					}
					assignedExperts = [{ ...creator, session_pricing: parsedPricing }];
				}
			} catch (errCreator) {
				console.warn('[slug:load] Failed to load creator expert:', errCreator);
			}
		}

		// Fallback to first active user if still empty
		if (assignedExperts.length === 0) {
			try {
				const anyUser = await db
					.prepare('SELECT id, name, email, slug, profile_image, role_title, bio, session_pricing, brand_color, timezone FROM users ORDER BY created_at ASC LIMIT 1')
					.first<any>();
				if (anyUser) {
					let parsedPricing = [];
					try {
						parsedPricing = anyUser.session_pricing ? JSON.parse(anyUser.session_pricing) : [];
					} catch (errAnyPricing) {
						console.warn('[slug:load] Failed to parse anyUser pricing:', errAnyPricing);
					}
					assignedExperts = [{ ...anyUser, session_pricing: parsedPricing }];
				}
			} catch (errAny) {
				console.warn('[slug:load] Failed to load fallback user:', errAny);
			}
		}

		// Absolute fallback to ensure booking page always renders even if database is fresh
		if (assignedExperts.length === 0) {
			assignedExperts = [{
				id: eventType.host_user_id || 'default_expert',
				name: eventType.host_name || 'Neubofy Specialist',
				email: eventType.host_email || 'meet@neubofy.in',
				slug: 'specialist',
				profile_image: null,
				role_title: 'Technology Consultant',
				bio: 'Senior technology consultant at Neubofy.',
				session_pricing: [],
				brand_color: '#3b82f6',
				timezone: 'Asia/Kolkata'
			}];
		}

		// Check if URL specifies an expert: ?expert=...
		const requestedExpertId = url.searchParams.get('expert');
		let defaultExpert = assignedExperts[0] || null;
		if (requestedExpertId) {
			const found = assignedExperts.find((e) => e.id === requestedExpertId || e.slug === requestedExpertId);
			if (found) defaultExpert = found;
		}

		let hostSettings: { timeFormat?: string; defaultInviteCalendar?: string } = {};
		try {
			hostSettings = eventType.host_settings ? JSON.parse(eventType.host_settings) : {};
		} catch {
			hostSettings = {};
		}

		let effectiveInviteCalendar = eventType.invite_calendar || hostSettings.defaultInviteCalendar || 'google';
		const outlookConfigured = !!(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET);
		if (effectiveInviteCalendar === 'outlook' && (!eventType.outlook_refresh_token || !outlookConfigured)) {
			effectiveInviteCalendar = 'google';
		}

		let parsedDurations: number[] = [30];
		try {
			parsedDurations = eventType.durations_json ? JSON.parse(eventType.durations_json) : [eventType.duration || 30];
		} catch {
			parsedDurations = [eventType.duration || 30];
		}

		return {
			slug: eventType.slug,
			eventType: {
				id: eventType.id,
				slug: eventType.slug,
				name: eventType.name,
				duration: eventType.duration,
				durations: parsedDurations,
				description: eventType.description,
				category: eventType.category || 'Decide',
				is_active: eventType.is_active,
				price_inr: eventType.price_inr || 0,
				cover_image: eventType.cover_image,
				invite_calendar: effectiveInviteCalendar
			},
			user: {
				name: organization.name,
				profileImage: organization.profile_image,
				brandColor: organization.brand_color || '#3b82f6',
				timeFormat: hostSettings.timeFormat || '12h'
			},
			host: {
				id: defaultExpert?.id,
				name: defaultExpert?.name || eventType.host_name || organization.name,
				roleTitle: defaultExpert?.role_title || 'Technology Consultant',
				profileImage: defaultExpert?.profile_image,
				bio: defaultExpert?.bio
			},
			assignedExperts,
			defaultExpertId: defaultExpert?.id || ''
		};
	} catch (err: any) {
		console.error('Booking page load error:', err);
		if (err?.status) throw err;
		throw error(500, 'Failed to load booking page');
	}
};
