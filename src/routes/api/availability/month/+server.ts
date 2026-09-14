/**
 * Monthly availability API endpoint
 * Returns which dates in a month have available slots for a specific expert.
 * Deterministic expert resolution and expert-keyed KV caching.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBusyTimes, getValidAccessToken } from '$lib/server/google-calendar';
import { getOutlookBusyTimes, getValidOutlookAccessToken } from '$lib/server/outlook-calendar';

interface TimeSlot {
	start: string;
	end: string;
}

export const GET: RequestHandler = async ({ url, platform }) => {
	const env = platform?.env;
	if (!env) {
		throw error(500, 'Platform env not available');
	}

	const eventSlug = url.searchParams.get('event');
	const month = url.searchParams.get('month'); // YYYY-MM
	const expertId = url.searchParams.get('expertId') || url.searchParams.get('expert');

	if (!eventSlug || !month) {
		throw error(400, 'Missing required parameters: event and month');
	}

	try {
		const db = env.DB;

		// 1. Fetch consultation event type
		const eventType = await db
			.prepare(
				`SELECT id, user_id, duration_minutes as duration, availability_calendars 
				 FROM event_types 
				 WHERE slug = ? AND is_active = 1 LIMIT 1`
			)
			.bind(eventSlug)
			.first<{ id: string; user_id: string | null; duration: number; availability_calendars: string | null }>();

		if (!eventType) {
			throw error(404, 'Consultation service not found or inactive');
		}

		// 2. Resolve target expert user deterministically
		let targetUserId: string | null = expertId;
		if (!targetUserId) {
			try {
				const assigned = await db
					.prepare(
						`SELECT etm.user_id 
						 FROM event_type_members etm
						 JOIN users u ON u.id = etm.user_id
						 WHERE etm.event_type_id = ? AND etm.is_active = 1
						 ORDER BY CASE WHEN u.id = ? THEN 0 ELSE 1 END, etm.created_at ASC, u.name ASC
						 LIMIT 1`
					)
					.bind(eventType.id, eventType.user_id || '')
					.first<{ user_id: string }>();

				targetUserId = assigned?.user_id || eventType.user_id || null;
			} catch (eAssigned) {
				targetUserId = eventType.user_id || null;
			}
		}

		let user: any = null;
		const queryParams: any[] = [];
		if (targetUserId) {
			queryParams.push(targetUserId, targetUserId);
		}

		try {
			let userQuery = 'SELECT id, slug, timezone, settings, outlook_refresh_token FROM users';
			if (targetUserId) {
				userQuery += ' WHERE id = ? OR slug = ?';
			} else {
				userQuery += ' ORDER BY created_at ASC';
			}
			userQuery += ' LIMIT 1';

			user = await db.prepare(userQuery).bind(...queryParams).first();
		} catch (eUser) {
			console.error('Failed to query user in month availability:', eUser);
		}

		if (!user) {
			throw error(404, 'Consultant not found');
		}

		// Check cache strictly keyed by expert ID to avoid cross-expert cache poisoning
		const cacheKey = `availability:month:${eventSlug}:${user.id}:${month}`;
		try {
			const cached = await env.KV?.get(cacheKey);
			if (cached) {
				return json(JSON.parse(cached));
			}
		} catch {}

		const userTimezone = user.timezone || 'Asia/Kolkata';

		// Parse user settings for global calendar defaults
		let userSettings: { defaultAvailabilityCalendars?: string; selectedGoogleCalendars?: string[] } = {};
		try {
			userSettings = user.settings ? JSON.parse(user.settings) : {};
		} catch {
			userSettings = {};
		}

		function createDateInTimezone(dateStr: string, timeStr: string, timezone: string): Date {
			const [hour, minute] = timeStr.split(':').map(Number);
			const dateTimeStr = `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;

			const formatter = new Intl.DateTimeFormat('en-US', {
				timeZone: timezone,
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
				hour12: false
			});

			const targetDate = new Date(dateTimeStr + 'Z');
			const parts = formatter.formatToParts(targetDate);
			const tzHour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
			const tzMinute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);

			const targetMinutes = hour * 60 + minute;
			const actualMinutes = tzHour * 60 + tzMinute;
			let offsetMinutes = actualMinutes - targetMinutes;

			if (offsetMinutes > 12 * 60) offsetMinutes -= 24 * 60;
			if (offsetMinutes < -12 * 60) offsetMinutes += 24 * 60;

			return new Date(targetDate.getTime() - offsetMinutes * 60 * 1000);
		}

		const availabilityCalendars = eventType.availability_calendars || userSettings.defaultAvailabilityCalendars || 'google';
		const useGoogleCalendar = availabilityCalendars === 'google' || availabilityCalendars === 'both';
		const useOutlookCalendar = availabilityCalendars === 'outlook' || availabilityCalendars === 'both';

		// Get all weekly availability rules for this specific expert
		const allRules = await db
			.prepare(
				`SELECT day_of_week, start_time, end_time
				 FROM availability_rules
				 WHERE user_id = ? AND is_active = 1
				 ORDER BY day_of_week, start_time`
			)
			.bind(user.id)
			.all<{ day_of_week: number; start_time: string; end_time: string }>();

		const rulesByDay = new Map<number, Array<{ start_time: string; end_time: string }>>();
		for (const rule of allRules.results || []) {
			if (!rulesByDay.has(rule.day_of_week)) {
				rulesByDay.set(rule.day_of_week, []);
			}
			rulesByDay.get(rule.day_of_week)!.push({ start_time: rule.start_time, end_time: rule.end_time });
		}

		// Parse month to get date range
		const [year, monthNum] = month.split('-').map(Number);
		const firstDay = new Date(year, monthNum - 1, 1);
		const lastDay = new Date(year, monthNum, 0, 23, 59, 59, 999);
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// Max date is 60 days from today
		const maxDate = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);

		// Get busy times from connected calendars for the entire month
		let busySlots: TimeSlot[] = [];

		if (useGoogleCalendar) {
			try {
				const accessToken = await getValidAccessToken(
					db,
					user.id,
					env.GOOGLE_CLIENT_ID,
					env.GOOGLE_CLIENT_SECRET
				);
				const googleBusy = await getBusyTimes(accessToken, firstDay, lastDay, userSettings.selectedGoogleCalendars);
				busySlots.push(...googleBusy);
			} catch (err) {}
		}

		if (useOutlookCalendar && env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET) {
			try {
				const outlookToken = await getValidOutlookAccessToken(
					db,
					user.id,
					env.MICROSOFT_CLIENT_ID,
					env.MICROSOFT_CLIENT_SECRET
				);
				const outlookBusy = await getOutlookBusyTimes(outlookToken, firstDay, lastDay);
				busySlots.push(...outlookBusy);
			} catch (err) {}
		}

		// Query existing confirmed bookings for this specific expert in this month
		const monthStartIso = `${month}-01T00:00:00`;
		const nextMonthDate = new Date(year, monthNum, 1);
		const nextMonthIso = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01T00:00:00`;

		const bookingsResult = await db
			.prepare(
				`SELECT start_time, end_time
				 FROM bookings
				 WHERE user_id = ? AND start_time >= ? AND start_time < ? AND status = 'confirmed'
				 ORDER BY start_time`
			)
			.bind(user.id, monthStartIso, nextMonthIso)
			.all<{ start_time: string; end_time: string }>();

		const allBusySlots = [
			...busySlots,
			...(bookingsResult.results || []).map((b) => ({ start: b.start_time, end: b.end_time }))
		];

		// Get date overrides for this month
		const overridesResult = await db
			.prepare(
				`SELECT date, available, start_time, end_time
				 FROM availability_overrides
				 WHERE user_id = ? AND date >= ? AND date <= ?`
			)
			.bind(user.id, `${month}-01`, `${month}-${String(lastDay.getDate()).padStart(2, '0')}`)
			.all<{ date: string; available: number; start_time: string | null; end_time: string | null }>();

		const overridesByDate = new Map<string, { available: boolean; start_time?: string; end_time?: string }>();
		for (const o of overridesResult.results || []) {
			overridesByDate.set(o.date, {
				available: o.available === 1,
				start_time: o.start_time || undefined,
				end_time: o.end_time || undefined
			});
		}

		const availableDates: string[] = [];
		const sessionDuration = eventType.duration || 30;
		const daysInMonth = lastDay.getDate();

		for (let day = 1; day <= daysInMonth; day++) {
			const dateStr = `${month}-${String(day).padStart(2, '0')}`;
			const dateObj = new Date(year, monthNum - 1, day);

			// Skip past days or beyond max range
			if (dateObj < today || dateObj > maxDate) continue;

			// Check override first
			if (overridesByDate.has(dateStr)) {
				const override = overridesByDate.get(dateStr)!;
				if (!override.available) continue;
			}

			const dayOfWeek = dateObj.getDay();
			let dayRules = rulesByDay.get(dayOfWeek) || [];

			// Default fallback hours if expert has not yet set custom rules (Mon-Sat 10:00 - 18:00)
			if (dayRules.length === 0 && dayOfWeek !== 0) {
				dayRules = [{ start_time: '10:00', end_time: '18:00' }];
			}

			if (dayRules.length === 0) continue;

			// Check if at least one available slot exists on this day
			let hasSlot = false;
			for (const rule of dayRules) {
				let currentTime = createDateInTimezone(dateStr, rule.start_time, userTimezone);
				const endTime = createDateInTimezone(dateStr, rule.end_time, userTimezone);

				while (currentTime < endTime) {
					const slotEnd = new Date(currentTime);
					slotEnd.setMinutes(slotEnd.getMinutes() + sessionDuration);
					if (slotEnd > endTime) break;

					// Must be in the future (at least 15 min from now)
					if (currentTime.getTime() > Date.now() + 15 * 60 * 1000) {
						const curStart = currentTime.getTime();
						const curEnd = slotEnd.getTime();

						const hasConflict = allBusySlots.some((busy) => {
							const bStart = new Date(busy.start).getTime();
							const bEnd = new Date(busy.end).getTime();
							return (
								(curStart >= bStart && curStart < bEnd) ||
								(curEnd > bStart && curEnd <= bEnd) ||
								(curStart <= bStart && curEnd >= bEnd)
							);
						});

						if (!hasConflict) {
							hasSlot = true;
							break;
						}
					}
					currentTime.setMinutes(currentTime.getMinutes() + Math.min(30, sessionDuration));
				}
				if (hasSlot) break;
			}

			if (hasSlot) {
				availableDates.push(dateStr);
			}
		}

		const responseData = {
			availableDates,
			timezone: userTimezone,
			expertId: user.id
		};

		try {
			await env.KV?.put(cacheKey, JSON.stringify(responseData), { expirationTtl: 180 });
		} catch {}

		return json(responseData);
	} catch (err: any) {
		console.error('Month availability error:', err);
		if (err?.status) throw err;
		throw error(500, 'Failed to fetch month availability');
	}
};
