/**
 * Booking page for a specific organization event type.
 * Returns event details, pricing, and all assigned expert specialists.
 */

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, platform, url }) => {
	const env = platform?.env;
	const db = env?.DB;

	if (!db) {
		return {
			slug: params.slug,
			eventType: {
				id: 'service_30min',
				slug: params.slug || 'consultation',
				name: 'Strategy & Architecture Consultation',
				duration: 30,
				durations: [30, 60],
				description: 'High-impact strategic evaluation of your technical architecture and software roadmap.',
				category: 'Decide',
				is_active: 1,
				is_free_only: true,
				price_inr: 0,
				cover_image: null,
				invite_calendar: 'google'
			},
			user: {
				name: 'Neubofy™',
				profileImage: 'https://neubofy.in/neubofylogo.png',
				brandColor: '#3b82f6',
				timeFormat: '12h'
			},
			host: {
				id: 'expert_lead',
				name: 'Neubofy Lead Specialist',
				roleTitle: 'Technology & AI Solutions Lead',
				profileImage: 'https://neubofy.in/neubofylogo.png',
				bio: 'Translating business problems into software architecture, cloud scalability, and verified delivery.'
			},
			assignedExperts: [{
				id: 'expert_lead',
				name: 'Neubofy Lead Specialist',
				email: 'meet@neubofy.in',
				slug: 'specialist',
				role_title: 'Technology & AI Solutions Lead',
				profile_image: 'https://neubofy.in/neubofylogo.png',
				bio: 'Translating business problems into software architecture, cloud scalability, and verified delivery.',
				session_pricing: [
					{ duration: 30, price: 999, label: '30 Min Strategy Consultation' },
					{ duration: 60, price: 1999, label: '60 Min Deep Dive' }
				]
			}],
			defaultExpertId: 'expert_lead'
		};
	}

	try {
		let organization = await db
			.prepare('SELECT id, slug, name, profile_image, brand_color, contact_email FROM organizations ORDER BY created_at LIMIT 1')
			.first<{ id: string; slug: string; name: string; profile_image: string | null; brand_color: string | null; contact_email: string | null }>();

		if (!organization) {
			organization = {
				id: 'org_neubofy_main',
				slug: 'neubofy',
				name: 'Neubofy™',
				profile_image: 'https://neubofy.in/neubofylogo.png',
				brand_color: '#3b82f6',
				contact_email: 'contact@neubofy.in'
			};
		}

		let eventType: any = null;
		let assignedExperts: any[] = [];
		let expertUser: any = null;

		// 1. Try finding consultation service by slug
		try {
			eventType = await db
				.prepare(
					`SELECT et.id, et.slug, et.name, et.duration_minutes as duration, et.durations_json,
						et.description, et.is_active, et.cover_image, et.invite_calendar, et.user_id as host_user_id,
						et.is_free_only, et.price_inr, et.category,
						u.name as host_name, u.email as host_email, u.settings as host_settings,
						u.outlook_refresh_token
					 FROM event_types et
					 LEFT JOIN users u ON u.id = et.user_id
					 WHERE (et.organization_id = ? OR et.organization_id IS NULL OR et.organization_id = 'org_neubofy_main')
					   AND et.slug = ?
					   AND COALESCE(et.is_active, 1) = 1
					   AND COALESCE(et.is_deleted, 0) = 0`
				)
				.bind(organization.id, params.slug)
				.first();
		} catch (err) {
			console.warn('Failed to query eventType by slug:', err);
		}

		// 2. If not an event type, check if params.slug is an EXPERT USER slug
		if (!eventType) {
			try {
				expertUser = await db
					.prepare(
						`SELECT id, name, email, slug, profile_image, role_title, bio, brand_color,
						        timezone, session_pricing, settings, outlook_refresh_token
						 FROM users
						 WHERE slug = ? AND is_active = 1 AND COALESCE(is_deleted, 0) = 0`
					)
					.bind(params.slug)
					.first<any>();

				if (expertUser) {
					// Find assigned service or default service for this expert
					const service = await db
						.prepare(
							`SELECT et.id, et.slug, et.name, et.duration_minutes as duration, et.durations_json,
							        et.description, et.is_active, et.cover_image, et.invite_calendar,
							        et.is_free_only, et.price_inr, et.category
							 FROM event_types et
							 JOIN event_type_members etm ON etm.event_type_id = et.id
							 WHERE etm.user_id = ? AND et.is_active = 1 AND COALESCE(et.is_deleted, 0) = 0
							 ORDER BY et.created_at ASC
							 LIMIT 1`
						)
						.bind(expertUser.id)
						.first<any>();

					if (service) {
						eventType = {
							...service,
							host_user_id: expertUser.id,
							host_name: expertUser.name,
							host_email: expertUser.email,
							host_settings: expertUser.settings,
							outlook_refresh_token: expertUser.outlook_refresh_token
						};
					} else {
						// Fallback to first active event type in org
						const firstEvent = await db
							.prepare(
								`SELECT id, slug, name, duration_minutes as duration, durations_json,
								        description, is_active, cover_image, invite_calendar,
								        et.is_free_only, et.price_inr, et.category
								 FROM event_types et
								 WHERE is_active = 1 AND COALESCE(is_deleted, 0) = 0
								 ORDER BY created_at ASC
								 LIMIT 1`
							)
							.first<any>();

						if (firstEvent) {
							eventType = {
								...firstEvent,
								host_user_id: expertUser.id,
								host_name: expertUser.name,
								host_email: expertUser.email,
								host_settings: expertUser.settings,
								outlook_refresh_token: expertUser.outlook_refresh_token
							};
						}
					}

					if (eventType) {
						let parsedPricing = [];
						try {
							parsedPricing = expertUser.session_pricing ? JSON.parse(expertUser.session_pricing) : [];
						} catch {}
						assignedExperts = [{ ...expertUser, session_pricing: parsedPricing }];
					}
				}
			} catch (errExpert) {
				console.warn('Failed to query expertUser by slug:', errExpert);
			}
		}

		if (!eventType) throw error(404, 'Consultation service or specialist not found');

		// If not already set by expert user slug lookup, fetch assigned active specialists
		if (assignedExperts.length === 0) {
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
					} catch {}
					return {
						...exp,
						session_pricing: parsedPricing
					};
				});
			} catch (errMembers) {
				console.warn('event_type_members query bypassed or failed:', errMembers);
			}
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
					} catch {}
					assignedExperts = [{ ...creator, session_pricing: parsedPricing }];
				}
			} catch {}
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
					} catch {}
					assignedExperts = [{ ...anyUser, session_pricing: parsedPricing }];
				}
			} catch {}
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
		let defaultExpert = expertUser || assignedExperts[0] || null;
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
				is_free_only: !!eventType.is_free_only,
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
