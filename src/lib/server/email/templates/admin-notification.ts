/**
 * Admin notification email template (new booking) - Neubofy Premium Dark Theme
 */

import type { BookingEmailData } from '../types';
import { createEmailFormatters } from '../formatters';
import { generateBaseEmail, generateAttendeeNotesCard, generateActionButton } from './base';

/**
 * Generate HTML email for admin / expert notification on new booking
 */
export function generateAdminNotificationEmail(data: BookingEmailData): string {
	const { formatDate, formatTime } = createEmailFormatters(data.timeFormat, data.timezone);
	const brandColor = data.brandColor || '#2563eb';

	const headerContent = `
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
			<tr>
				<td align="center">
					<div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; text-align: center; background-color: rgba(37, 99, 235, 0.15); border: 1px solid rgba(37, 99, 235, 0.3); border-radius: 50%; margin-bottom: 16px;">
						<span style="font-size: 24px; color: #60a5fa; line-height: 56px;">📅</span>
					</div>
					<h1 style="margin: 0 0 8px; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
						New Consultation Booked!
					</h1>
					<p style="margin: 0; color: #a1a1aa; font-size: 14px;">
						A new client session has been scheduled on your calendar.
					</p>
				</td>
			</tr>
		</table>
	`;

	const attendeeNotes = data.attendeeNotes
		? generateAttendeeNotesCard(data.attendeeName, data.attendeeNotes)
		: '';

	const meetingLabel = data.meetingType === 'teams' ? 'Join Microsoft Teams' : 'Join Google Meet Session';
	const actionButton = data.meetingUrl
		? generateActionButton(data.meetingUrl, meetingLabel, brandColor)
		: '';

	const bodyContent = `
		<p style="margin: 0 0 20px; color: #e4e4e7; font-size: 15px; line-height: 24px;">
			Hi <strong style="color: #ffffff;">${data.hostName}</strong>, a client has booked a consultation session with you.
		</p>

		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; background-color: #18181f; border-radius: 12px; border: 1px solid #27272a; border-left: 4px solid #3b82f6; margin-bottom: 28px;">
			<tr>
				<td style="padding: 22px 24px;">
					<div style="color: #3b82f6; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px;">
						Attendee & Meeting Info
					</div>

					<div style="margin-bottom: 14px;">
						<div style="color: #a1a1aa; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 2px;">Client</div>
						<div style="color: #ffffff; font-size: 16px; font-weight: 700;">${data.attendeeName}</div>
						<div style="color: #60a5fa; font-size: 13px;">
							<a href="mailto:${data.attendeeEmail}" style="color: #60a5fa; text-decoration: none;">${data.attendeeEmail}</a>
						</div>
					</div>

					<div style="margin-bottom: 14px;">
						<div style="color: #a1a1aa; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 2px;">Consultation Service</div>
						<div style="color: #ffffff; font-size: 15px; font-weight: 600;">${data.eventName}</div>
					</div>

					<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
						<tr>
							<td width="50%" align="left" style="vertical-align: top; padding-right: 8px;">
								<div style="color: #a1a1aa; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 2px;">Date</div>
								<div style="color: #ffffff; font-size: 14px; font-weight: 600;">📅 ${formatDate(data.startTime)}</div>
							</td>
							<td width="50%" align="left" style="vertical-align: top; padding-left: 8px;">
								<div style="color: #a1a1aa; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 2px;">Time</div>
								<div style="color: #ffffff; font-size: 14px; font-weight: 600;">⏰ ${formatTime(data.startTime)} - ${formatTime(data.endTime)}</div>
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>

		${attendeeNotes}
		${actionButton}
	`;

	return generateBaseEmail({
		title: `New Booking: ${data.eventName} with ${data.attendeeName}`,
		badgeText: 'NEW APPOINTMENT',
		badgeColor: '#10b981',
		badgeBg: 'rgba(16, 185, 129, 0.15)',
		headerContent,
		bodyContent,
		footerContent: `Neubofy Specialist Portal &bull; Booking notification for ${data.hostName}.`,
		hostName: data.hostName,
		brandColor
	});
}
