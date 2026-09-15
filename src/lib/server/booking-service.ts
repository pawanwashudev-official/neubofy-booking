/**
 * Booking Service
 * Handles calendar event provisioning and email dispatches
 * for both free and paid consultation confirmations.
 */

import { createCalendarEvent, getValidAccessToken } from '$lib/server/google-calendar';
import { createOutlookCalendarEvent, getValidOutlookAccessToken } from '$lib/server/outlook-calendar';
import {
	sendBookingEmail,
	sendAdminNotificationEmail,
	getEmailTemplates,
	getOrganizationEmailConfig,
	isEmailEnabled,
	type EmailTemplateType
} from '$lib/server/email';

export async function finalizeConfirmedBooking(
	db: D1Database,
	env: App.Platform['env'],
	bookingId: string
): Promise<{ success: boolean; meetingUrl: string | null }> {
	// Query full booking record with joined event type and host details
	const booking = await db
		.prepare(
			`SELECT b.id, b.start_time, b.end_time, b.duration_minutes,
			        b.attendee_name, b.attendee_email, b.attendee_phone, b.attendee_notes,
			        b.goal, b.reason, b.expectations, b.price_amount, b.discount_amount,
			        b.coupon_code, b.is_paid, b.google_event_id, b.outlook_event_id, b.meeting_url,
			        e.name as event_name, e.slug as event_slug, e.description as event_description,
			        e.invite_calendar,
			        u.id as host_user_id, u.name as host_name, u.email as host_email,
			        u.contact_email, u.settings, u.brand_color, u.outlook_refresh_token
			 FROM bookings b
			 JOIN event_types e ON b.event_type_id = e.id
			 JOIN users u ON b.user_id = u.id
			 WHERE b.id = ? AND COALESCE(b.is_deleted, 0) = 0`
		)
		.bind(bookingId)
		.first<{
			id: string;
			start_time: string;
			end_time: string;
			duration_minutes: number;
			attendee_name: string;
			attendee_email: string;
			attendee_phone: string | null;
			attendee_notes: string | null;
			goal: string | null;
			reason: string | null;
			expectations: string | null;
			price_amount: number;
			discount_amount: number;
			coupon_code: string | null;
			is_paid: number;
			google_event_id: string | null;
			outlook_event_id: string | null;
			meeting_url: string | null;
			event_name: string;
			event_slug: string;
			event_description: string | null;
			invite_calendar: string | null;
			host_user_id: string;
			host_name: string;
			host_email: string;
			contact_email: string | null;
			settings: string | null;
			brand_color: string | null;
			outlook_refresh_token: string | null;
		}>();

	if (!booking) {
		throw new Error('Booking not found');
	}

	// If already provisioned, return existing meeting URL
	if (booking.meeting_url) {
		return { success: true, meetingUrl: booking.meeting_url };
	}

	const startDateTime = new Date(booking.start_time);
	const endDateTime = new Date(booking.end_time);

	// Parse host settings
	let hostSettings: { defaultInviteCalendar?: string; timeFormat?: string } = {};
	try {
		hostSettings = booking.settings ? JSON.parse(booking.settings) : {};
	} catch {
		hostSettings = {};
	}

	let inviteCalendar = booking.invite_calendar || hostSettings.defaultInviteCalendar || 'google';
	if (inviteCalendar === 'outlook' && (!booking.outlook_refresh_token || !env.MICROSOFT_CLIENT_ID)) {
		inviteCalendar = 'google';
	}

	let googleEventId = booking.google_event_id;
	let outlookEventId = booking.outlook_event_id;
	let meetingUrl = booking.meeting_url;

	const intakeDetailsText = [
		booking.goal ? `Goal: ${booking.goal}` : null,
		booking.reason ? `Reason: ${booking.reason}` : null,
		booking.expectations ? `Expectations: ${booking.expectations}` : null,
		booking.attendee_phone ? `Mobile/WhatsApp: ${booking.attendee_phone}` : null,
		booking.attendee_notes ? `Notes: ${booking.attendee_notes}` : null
	]
		.filter(Boolean)
		.join('\n\n');

	const eventSummary = `Neubofy Consultation: ${booking.event_name} - ${booking.attendee_name}`;
	const eventDescription = `Consultation with Neubofy Expert: ${booking.host_name}\nClient: ${booking.attendee_name} (${booking.attendee_email})\nPhone: ${booking.attendee_phone || 'Not provided'}\n\nClient Intake Information:\n${intakeDetailsText || 'None provided'}\n\nPlatform: booking.neubofy.in`;

	// Provision Calendar Event
	if (inviteCalendar === 'google') {
		try {
			const accessToken = await getValidAccessToken(
				db,
				booking.host_user_id,
				env.GOOGLE_CLIENT_ID,
				env.GOOGLE_CLIENT_SECRET,
				env.JWT_SECRET
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
				attendees: [{ email: booking.attendee_email }],
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
			console.error('Error provisioning Google Calendar event:', err);
		}
	} else if (inviteCalendar === 'outlook' && env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET) {
		try {
			const outlookToken = await getValidOutlookAccessToken(
				db,
				booking.host_user_id,
				env.MICROSOFT_CLIENT_ID,
				env.MICROSOFT_CLIENT_SECRET,
				env.JWT_SECRET
			);

			const outlookEvent = await createOutlookCalendarEvent(outlookToken, {
				summary: eventSummary,
				description: eventDescription,
				startTime: startDateTime.toISOString(),
				endTime: endDateTime.toISOString(),
				attendeeEmail: booking.attendee_email,
				hostEmail: booking.host_email,
				createTeamsMeeting: true
			});

			outlookEventId = outlookEvent.id;
			if (outlookEvent.onlineMeeting?.joinUrl) {
				meetingUrl = outlookEvent.onlineMeeting.joinUrl;
			}
		} catch (err) {
			console.error('Error provisioning Outlook Calendar event:', err);
		}
	}

	// Update booking with generated calendar event IDs and meeting link
	await db
		.prepare(
			`UPDATE bookings 
			 SET google_event_id = ?, outlook_event_id = ?, meeting_url = ? 
			 WHERE id = ?`
		)
		.bind(googleEventId, outlookEventId, meetingUrl, booking.id)
		.run();

	// Dispatch Confirmation and Admin Emails
	if (env.RESEND_API_KEY) {
		try {
			const templates = await getEmailTemplates(db, booking.host_user_id);
			const emailConfig = await getOrganizationEmailConfig(db, booking.host_user_id, env);
			const timeFormat = hostSettings.timeFormat === '24h' ? '24h' : '12h';

			if (isEmailEnabled(templates, 'confirmation')) {
				const template = templates.get('confirmation');
				await sendBookingEmail(
					{
						attendeeName: booking.attendee_name,
						attendeeEmail: booking.attendee_email,
						eventName: booking.event_name,
						eventSlug: booking.event_slug,
						eventDescription: booking.event_description || '',
						startTime: startDateTime,
						endTime: endDateTime,
						meetingUrl,
						bookingId: booking.id,
						hostName: booking.host_name,
						hostEmail: booking.host_email,
						hostContactEmail: booking.contact_email || undefined,
						appUrl: env.APP_URL || '',
						customMessage: template?.custom_message,
						timeFormat,
						brandColor: booking.brand_color || undefined
					},
					{
						apiKey: env.RESEND_API_KEY,
						from: emailConfig.from,
						replyTo: emailConfig.replyTo
					},
					template?.subject || undefined
				);
			}

			// Admin notification email
			try {
				await sendAdminNotificationEmail(
					{
						attendeeName: booking.attendee_name,
						attendeeEmail: booking.attendee_email,
						eventName: booking.event_name,
						eventSlug: booking.event_slug,
						eventDescription: booking.event_description || '',
						startTime: startDateTime,
						endTime: endDateTime,
						meetingUrl,
						bookingId: booking.id,
						hostName: booking.host_name,
						hostEmail: booking.host_email,
						appUrl: env.APP_URL || '',
						timeFormat,
						brandColor: booking.brand_color || undefined
					},
					booking.host_email,
					{
						apiKey: env.RESEND_API_KEY,
						from: emailConfig.from
					}
				);
			} catch (adminErr) {
				console.error('Failed to send admin notification email:', adminErr);
			}
		} catch (emailErr) {
			console.error('Failed to send confirmation emails:', emailErr);
		}
	}

	return { success: true, meetingUrl };
}
