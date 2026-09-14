/**
 * Booking confirmation email template - Neubofy Premium Dark Theme
 */

import type { BookingEmailData } from '../types';
import { createEmailFormatters } from '../formatters';
import {
	generateBaseEmail,
	generateMeetingDetailsCard,
	generateYourMessageCard,
	generateActionButton,
	generateManagementLinks
} from './base';

/**
 * Generate HTML email template for booking confirmation
 */
export function generateBookingEmail(data: BookingEmailData): string {
	const { formatDate, formatTime } = createEmailFormatters(data.timeFormat, data.timezone);
	const contactEmail = data.hostContactEmail || data.hostEmail;
	const brandColor = data.brandColor || '#2563eb';

	const cancelUrl = `${data.appUrl}/cancel/${data.bookingId}`;
	const rescheduleUrl = `${data.appUrl}/reschedule/${data.bookingId}`;

	const headerContent = `
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
			<tr>
				<td align="center">
					<div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; text-align: center; background-color: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 50%; margin-bottom: 16px;">
						<span style="font-size: 26px; color: #10b981; line-height: 56px;">✓</span>
					</div>
					<h1 style="margin: 0 0 8px; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
						Consultation Confirmed!
					</h1>
					<p style="margin: 0; color: #a1a1aa; font-size: 14px;">
						Your session with <strong style="color: #ffffff;">${data.hostName}</strong> is locked in.
					</p>
				</td>
			</tr>
		</table>
	`;

	const meetingLabel = data.meetingType === 'teams' ? 'Join Microsoft Teams Meeting' : 'Join Google Meet Session';

	const meetingDetails = generateMeetingDetailsCard({
		eventName: data.eventName,
		eventDescription: data.eventDescription,
		formattedDate: formatDate(data.startTime),
		formattedTime: `${formatTime(data.startTime)} - ${formatTime(data.endTime)}`,
		meetingUrl: data.meetingUrl,
		meetingType: data.meetingType,
		brandColor
	});

	const attendeeNotes = data.attendeeNotes
		? generateYourMessageCard(data.attendeeNotes)
		: '';

	const actionButton = data.meetingUrl
		? generateActionButton(data.meetingUrl, meetingLabel, brandColor)
		: '';

	const managementLinks = generateManagementLinks(rescheduleUrl, cancelUrl, brandColor);

	const bodyContent = `
		<p style="margin: 0 0 16px; color: #e4e4e7; font-size: 15px; line-height: 24px;">
			Hi <strong style="color: #ffffff;">${data.attendeeName}</strong>,
		</p>
		<p style="margin: 0 0 24px; color: #d4d4d8; font-size: 15px; line-height: 24px;">
			Thank you for scheduling with Neubofy. Your consultation has been added to our calendar and our expert has been notified.
		</p>

		${meetingDetails}
		${attendeeNotes}
		${actionButton}
		${managementLinks}

		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #1e2029;">
			<tr>
				<td>
					<p style="margin: 0; color: #a1a1aa; font-size: 13px; line-height: 20px;">
						Need to prepare materials or have preliminary questions? Reply directly to this email or reach our team at <a href="mailto:${contactEmail}" style="color: #60a5fa; text-decoration: none;">${contactEmail}</a>.
					</p>
				</td>
			</tr>
		</table>
	`;

	return generateBaseEmail({
		title: `Confirmed: ${data.eventName} with ${data.hostName}`,
		badgeText: 'CONFIRMED',
		badgeColor: '#10b981',
		badgeBg: 'rgba(16, 185, 129, 0.15)',
		headerContent,
		bodyContent,
		footerContent: `This is an automated confirmation for ${data.attendeeName} regarding ${data.eventName}.`,
		hostName: data.hostName,
		brandColor
	});
}

/**
 * Generate plain text version of booking email
 */
export function generateBookingEmailText(data: BookingEmailData): string {
	const { formatDateTime } = createEmailFormatters(data.timeFormat, data.timezone);
	const contactEmail = data.hostContactEmail || data.hostEmail;

	const cancelUrl = `${data.appUrl}/cancel/${data.bookingId}`;
	const rescheduleUrl = `${data.appUrl}/reschedule/${data.bookingId}`;

	return `
[NEUBOFY] CONSULTATION CONFIRMED

Hi ${data.attendeeName},

Your meeting with ${data.hostName} has been confirmed.

SESSION DETAILS
-------------------------------------------
Topic: ${data.eventName}
${data.eventDescription ? `Description: ${data.eventDescription}\n` : ''}Time: ${formatDateTime(data.startTime)} - ${formatDateTime(data.endTime)}
${data.meetingUrl ? `Meeting Link: ${data.meetingUrl}\n` : ''}
${data.attendeeNotes ? `Your Notes: ${data.attendeeNotes}\n` : ''}
MANAGE YOUR BOOKING
-------------------------------------------
Reschedule: ${rescheduleUrl}
Cancel: ${cancelUrl}

Support: ${contactEmail}

---
Powered by Neubofy Enterprise Consultations (https://neubofy.in)
	`.trim();
}
