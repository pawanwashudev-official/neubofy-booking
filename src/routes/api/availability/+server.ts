/**
 * Availability API endpoint
 * Returns available time slots for a specific expert and consultation service based on:
 * 1. Expert's availability rules (weekly schedule)
 * 2. Google Calendar busy times
 * 3. Outlook Calendar busy times
 * 4. Existing bookings
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
	const date = url.searchParams.get('date'); // YYYY-MM-DD
	const expertId = url.searchParams.get('expertId') || url.searchParams.get('expert');
	const durationParam = url.searchParams.get('duration');

	if (!eventSlug || !date) {
		throw error(400, 'Missing required parameters: event and date');
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
		const params: any[] = [];
		if (targetUserId) {
			params.push(targetUserId, targetUserId);
		}

		try {
			let userQuery = 'SELECT id, slug, timezone, settings FROM users';
			if (targetUserId) {
				userQuery += ' WHERE id = ? OR slug = ?';
			} else {
				userQuery += ' ORDER BY created_at ASC';
			}
			userQuery += ' LIMIT 1';

			user = await db.prepare(userQuery).bind(...params).first();
		} catch (eUser) {
			console.error('Failed to query user in slot availability:', eUser);
		}

		if (!user) {
			throw error(404, 'Consultant not found');
		}

		// Selected duration
		const sessionDuration = durationParam ? parseInt(durationParam, 10) : (eventType.duration || 30);

		// Cache check
		const cacheKey = `availability:${eventSlug}:${user.id}:${sessionDuration}:${date}`;
		try {
			const cached = await env.KV?.get(cacheKey);
			if (cached) {
				return json(JSON.parse(cached));
			}
		} catch {}

		const userTimezone = user.timezone || 'Asia/Kolkata';

		let userSettings: { defaultAvailabilityCalendars?: string; selectedGoogleCalendars?: string[] } = {};
		try {
			userSettings = user.settings ? JSON.parse(user.settings) : {};
		} catch {
			userSettings = {};
		}

		const availabilityCalendars = eventType.availability_calendars || userSettings.defaultAvailabilityCalendars || 'google';
		const useGoogleCalendar = availabilityCalendars === 'google' || availabilityCalendars === 'both';
		const useOutlookCalendar = availabilityCalendars === 'outlook' || availabilityCalendars === 'both';

		const requestedDate = new Date(date);
		const dayOfWeek = requestedDate.getDay();

		// Query expert's availability rules for this day of week
		let availabilityRules = await db
			.prepare(
				`SELECT start_time, end_time
				 FROM availability_rules
				 WHERE user_id = ? AND day_of_week = ? AND is_active = 1
				 ORDER BY start_time`
			)
			.bind(user.id, dayOfWeek)
			.all<{ start_time: string; end_time: string }>();

		// Fallback business hours (Mon-Sat 10:00 - 18:00) if expert has not yet set custom rules
		let activeRules = availabilityRules.results || [];
		if (activeRules.length === 0 && dayOfWeek !== 0) {
			activeRules = [{ start_time: '10:00', end_time: '18:00' }];
		}

		if (activeRules.length === 0) {
			return json({ slots: [] });
		}

		// Date overrides check (e.g. holidays or leaves)
		const override = await db
			.prepare(
				`SELECT available, start_time, end_time 
				 FROM availability_overrides 
				 WHERE user_id = ? AND date = ? LIMIT 1`
			)
			.bind(user.id, date)
			.first<{ available: number; start_time: string | null; end_time: string | null }>();

		if (override) {
			if (!override.available) {
				return json({ slots: [] });
			}
			if (override.start_time && override.end_time) {
				activeRules = [{ start_time: override.start_time, end_time: override.end_time }];
			}
		}

		// Query busy times
		const startOfDay = new Date(requestedDate);
		startOfDay.setHours(0, 0, 0, 0);
		const endOfDay = new Date(requestedDate);
		endOfDay.setHours(23, 59, 59, 999);

		let busySlots: TimeSlot[] = [];

		if (useGoogleCalendar) {
			try {
				const accessToken = await getValidAccessToken(
					db,
					user.id,
					env.GOOGLE_CLIENT_ID,
					env.GOOGLE_CLIENT_SECRET
				);
				const googleBusy = await getBusyTimes(accessToken, startOfDay, endOfDay, userSettings.selectedGoogleCalendars);
				busySlots.push(...googleBusy);
			} catch (err) {
				// Continue if calendar not connected yet
			}
		}

		if (useOutlookCalendar && env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET) {
			try {
				const outlookToken = await getValidOutlookAccessToken(
					db,
					user.id,
					env.MICROSOFT_CLIENT_ID,
					env.MICROSOFT_CLIENT_SECRET
				);
				const outlookBusy = await getOutlookBusyTimes(outlookToken, startOfDay, endOfDay);
				busySlots.push(...outlookBusy);
			} catch {}
		}

		// Query existing confirmed bookings for this expert
		const nextDayDate = new Date(requestedDate);
		nextDayDate.setDate(nextDayDate.getDate() + 1);
		const nextDayStr = nextDayDate.toISOString().split('T')[0];

		const bookings = await db
			.prepare(
				`SELECT start_time, end_time
				 FROM bookings
				 WHERE user_id = ? AND (DATE(start_time) = ? OR (start_time >= ? AND start_time < ?)) AND status = 'confirmed'
				 ORDER BY start_time`
			)
			.bind(user.id, date, `${date}T00:00:00`, `${nextDayStr}T00:00:00`)
			.all<{ start_time: string; end_time: string }>();

		const allBusySlots = [
			...busySlots.map((slot) => ({ start: slot.start, end: slot.end })),
			...(bookings.results || []).map((b) => ({ start: b.start_time, end: b.end_time }))
		];

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

		const slots: TimeSlot[] = [];
		const slotIncrement = Math.min(30, sessionDuration);

		for (const rule of activeRules) {
			let currentTime = createDateInTimezone(date, rule.start_time, userTimezone);
			const endTime = createDateInTimezone(date, rule.end_time, userTimezone);

			while (currentTime < endTime) {
				const slotEnd = new Date(currentTime);
				slotEnd.setMinutes(slotEnd.getMinutes() + sessionDuration);

				if (slotEnd > endTime) break;

				// Skip past slots
				if (currentTime.getTime() <= Date.now() + 15 * 60 * 1000) {
					currentTime.setMinutes(currentTime.getMinutes() + slotIncrement);
					continue;
				}

				const hasConflict = allBusySlots.some((busy) => {
					const busyStart = new Date(busy.start).getTime();
					const busyEnd = new Date(busy.end).getTime();
					const curStart = currentTime.getTime();
					const curEnd = slotEnd.getTime();
					return (
						(curStart >= busyStart && curStart < busyEnd) ||
						(curEnd > busyStart && curEnd <= busyEnd) ||
						(curStart <= busyStart && curEnd >= busyEnd)
					);
				});

				if (!hasConflict) {
					slots.push({
						start: currentTime.toISOString(),
						end: slotEnd.toISOString()
					});
				}

				currentTime.setMinutes(currentTime.getMinutes() + slotIncrement);
			}
		}

		try {
			await env.KV?.put(cacheKey, JSON.stringify({ slots }), { expirationTtl: 180 });
		} catch {}

		return json({ slots, timezone: userTimezone });
	} catch (err: any) {
		console.error('Availability API error:', err);
		if (err?.status) throw err;
		throw error(500, 'Failed to fetch consultant availability');
	}
};
