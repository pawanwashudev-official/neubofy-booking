/**
 * Bookings API endpoint
 * Creates verified consultation bookings and adds them to Google Calendar / Meet
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createCalendarEvent, getValidAccessToken } from '$lib/server/google-calendar';
import { createOutlookCalendarEvent, getValidOutlookAccessToken } from '$lib/server/outlook-calendar';
import { sendBookingEmail, sendAdminNotificationEmail, getEmailTemplates, getOrganizationEmailConfig, isEmailEnabled, type EmailTemplateType } from '$lib/server/email';
import { isValidEmail, validateLength, validateFields, MAX_LENGTHS } from '$lib/server/validation';

async function verifyOtpToken(token: string, secret: string, email: string): Promise<boolean> {
	try {
		const [data, signature] = token.split('.');
		if (!data || !signature) return false;

		const encoder = new TextEncoder();
		const keyData = encoder.encode(`${data}.${secret}`);
		const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const expectedSignature = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

		if (signature !== expectedSignature) return false;

		const payload = JSON.parse(atob(data));
		if (payload.email?.toLowerCase() !== email.toLowerCase()) return false;

		// Token valid for 30 minutes
		const age = Date.now() - payload.verifiedAt;
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

		// Strict Email OTP Verification check
		const secret = env.JWT_SECRET || 'neubofy-booking-secret-salt-2026';
		if (!verificationToken || !(await verifyOtpToken(verificationToken, secret, attendeeEmail))) {
			throw error(400, 'Email verification required. Please verify your email with the 6-digit code before booking.');
		}

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
				`SELECT id, user_id, name, duration_minutes as duration, description, invite_calendar 
				 FROM event_types 
				 WHERE slug = ? AND is_active = 1 LIMIT 1`
			)
			.bind(eventSlug)
			.first<{ id: string; user_id: string | null; name: string; duration: number; description: string | null; invite_calendar: string | null }>();

		if (!eventType) {
			throw error(404, 'Consultation service not found or inactive');
		}

		// Determine target expert user ID
		let hostUserId = expertUserId;
		if (!hostUserId) {
			// Find assigned member
			const assigned = await db
				.prepare('SELECT user_id FROM event_type_members WHERE event_type_id = ? AND is_active = 1 LIMIT 1')
				.bind(eventType.id)
				.first<{ user_id: string }>();
			hostUserId = assigned?.user_id || eventType.user_id || undefined;
		}

		if (!hostUserId) {
			// Fall back to any active member/owner
			const fallbackUser = await db
				.prepare('SELECT id FROM users WHERE is_active = 1 ORDER BY created_at LIMIT 1')
				.first<{ id: string }>();
			hostUserId = fallbackUser?.id;
		}

		if (!hostUserId) {
			throw error(404, 'No available consultant found for this service.');
		}

		const user = await db
			.prepare(
				`SELECT id, email, name, slug, contact_email, settings, brand_color, outlook_refresh_token 
				 FROM users WHERE id = ? AND is_active = 1`
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
			}>();

		if (!user) throw error(404, 'Selected consultant not found');

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
				 WHERE user_id = ? AND status = 'confirmed'
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

		// Create calendar event
		let googleEventId: string | null = null;
		let outlookEventId: string | null = null;
		let meetingUrl: string | null = null;

		const intakeDetailsText = [
			goal ? `Goal: ${goal}` : null,
			reason ? `Reason: ${reason}` : null,
			expectations ? `Expectations: ${expectations}` : null,
			attendeePhone ? `Mobile/WhatsApp: ${attendeePhone}` : null,
			notes ? `Notes: ${notes}` : null
		]
			.filter(Boolean)
			.join('\n\n');

		const eventSummary = `Neubofy Consultation: ${eventType.name} - ${attendeeName}`;
		const eventDescription = `Consultation with Neubofy Expert: ${user.name}\nClient: ${attendeeName} (${attendeeEmail})\nPhone: ${attendeePhone || 'Not provided'}\n\nClient Intake Information:\n${intakeDetailsText || 'None provided'}\n\nPlatform: booking.neubofy.in`;

		if (inviteCalendar === 'google') {
			try {
				const accessToken = await getValidAccessToken(
					db,
					user.id,
					env.GOOGLE_CLIENT_ID,
					env.GOOGLE_CLIENT_SECRET
				);

				const calendarEvent = await createCalendarEvent(accessToken, {
					summary: eventSummary,
					description: eventDescription,
					start: {
						dateTime: startDateTime.toISOString(),
						timeZone: 'UTC'
					},
					end: {
						dateTime: endDateTime.toISOString(),
						timeZone: 'UTC'
					},
					attendees: [{ email: attendeeEmail }],
					conferenceData: {
						createRequest: {
							requestId: crypto.randomUUID(),
							conferenceSolutionKey: { type: 'hangoutsMeet' }
						}
					}
				});

				googleEventId = calendarEvent.id;
				meetingUrl = calendarEvent.hangoutLink || null;
			} catch (err) {
				console.error('Error creating Google Calendar event:', err);
			}
		} else if (inviteCalendar === 'outlook' && env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET) {
			try {
				const outlookToken = await getValidOutlookAccessToken(
					db,
					user.id,
					env.MICROSOFT_CLIENT_ID,
					env.MICROSOFT_CLIENT_SECRET
				);

				const outlookEvent = await createOutlookCalendarEvent(outlookToken, {
					summary: eventSummary,
					description: eventDescription,
					startTime: startDateTime.toISOString(),
					endTime: endDateTime.toISOString(),
					attendeeEmail,
					hostEmail: user.email,
					createTeamsMeeting: true
				});

				outlookEventId = outlookEvent.id;
				if (outlookEvent.onlineMeeting?.joinUrl) {
					meetingUrl = outlookEvent.onlineMeeting.joinUrl;
				}
			} catch (err) {
				console.error('Error creating Outlook Calendar event:', err);
			}
		}

		// Insert booking record into database
		const bookingId = crypto.randomUUID();
		await db
			.prepare(
				`INSERT INTO bookings (
					id, organization_id, user_id, event_type_id, start_time, end_time, duration_minutes,
					attendee_name, attendee_email, attendee_phone, attendee_notes, goal, reason, expectations,
					price_amount, is_paid, email_verified, status,
					google_event_id, outlook_event_id, meeting_url, created_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'confirmed', ?, ?, ?, CURRENT_TIMESTAMP)`
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
				0, // complimentary consultation
				0, // is_paid = 0
				googleEventId,
				outlookEventId,
				meetingUrl
			)
			.run();

		// Invalidate availability cache
		try {
			const dateStr = startDateTime.toISOString().split('T')[0];
			const cacheKey = `availability:${eventSlug}:${user.id}:${dateStr}`;
			await env.KV?.delete(cacheKey);
		} catch {}

		// Send booking confirmation email via Resend
		const emailApiKey = env.RESEND_API_KEY || env.EMAILIT_API_KEY;
		if (emailApiKey) {
			try {
				let timeFormat: '12h' | '24h' = '12h';
				try {
					const settings = user.settings ? JSON.parse(user.settings) : {};
					timeFormat = settings.timeFormat === '24h' ? '24h' : '12h';
				} catch {}

				const templates = await getEmailTemplates(db, user.id);
				const emailConfig = await getOrganizationEmailConfig(db, user.id, env);
				const confirmationEnabled = isEmailEnabled(templates, 'confirmation');

				const emailData = {
					attendeeName,
					attendeeEmail,
					eventName: eventType.name,
					eventDescription: eventType.description || '',
					startTime: startDateTime,
					endTime: endDateTime,
					meetingUrl,
					meetingType: (inviteCalendar === 'outlook' ? 'teams' : 'google_meet') as 'google_meet' | 'teams',
					bookingId,
					hostName: user.name,
					hostEmail: user.email,
					hostContactEmail: user.contact_email || undefined,
					appUrl: env.APP_URL || 'https://booking.neubofy.in',
					timeFormat,
					timezone: timezone || 'UTC',
					brandColor: user.brand_color || '#3b82f6',
					attendeeNotes: intakeDetailsText || notes || undefined
				};

				if (confirmationEnabled) {
					const template = templates.get('confirmation');
					await sendBookingEmail(
						{
							...emailData,
							customMessage: template?.custom_message
						},
						{
							apiKey: emailApiKey,
							from: emailConfig.from,
							replyTo: emailConfig.replyTo
						},
						template?.subject || undefined
					);
				}

				// Send notification to expert host
				await sendAdminNotificationEmail(emailData, user.contact_email || user.email, {
					apiKey: emailApiKey,
					from: emailConfig.from
				});
			} catch (emailError) {
				console.error('Failed to send confirmation email:', emailError);
			}
		}

		return json({
			success: true,
			bookingId,
			meetingUrl,
			meetingType: inviteCalendar === 'outlook' ? 'teams' : 'google_meet',
			expertName: user.name,
			serviceName: eventType.name,
			startTime,
			endTime
		});
	} catch (err: any) {
		console.error('Booking creation error:', err);
		if (err?.status) throw err;
		throw error(500, err?.message || 'Failed to create consultation booking.');
	}
};
