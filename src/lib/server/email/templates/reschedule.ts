/**
 * Reschedule email templates - Neubofy Premium Dark Theme
 */

import type { RescheduleEmailData } from '../types';
import { createEmailFormatters } from '../formatters';
import { generateBaseEmail, generateActionButton, generateManagementLinks, generateYourMessageCard, generateAttendeeNotesCard } from './base';

/**
 * Generate HTML email for attendee reschedule notification
 */
export function generateRescheduleEmail(data: RescheduleEmailData): string {
	const { formatDate, formatTime } = createEmailFormatters(data.timeFormat, data.timezone);
	const brandColor = data.brandColor || '#2563eb';

	const cancelUrl = `${data.appUrl}/cancel/${data.bookingId}`;
	const rescheduleUrl = `${data.appUrl}/reschedule/${data.bookingId}`;

	const headerContent = `
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
			<tr>
				<td align="center">
					<div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; text-align: center; background-color: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 50%; margin-bottom: 16px;">
						<span style="font-size: 24px; color: #f59e0b; line-height: 56px;">↻</span>
					</div>
					<h1 style="margin: 0 0 8px; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
						Meeting Rescheduled
					</h1>
					<p style="margin: 0; color: #a1a1aa; font-size: 14px;">
						Your consultation time has been successfully updated.
					</p>
				</td>
			</tr>
		</table>
	`;

	const customMessageSection = data.customMessage ? `
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #1f170e; border-radius: 12px; border: 1px solid #4a3314; border-left: 4px solid #f59e0b; margin-bottom: 24px;">
			<tr>
				<td style="padding: 16px 20px;">
					<div style="color: #fbbf24; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Note from host:</div>
					<div style="color: #fef3c7; font-size: 14px; line-height: 20px;">${data.customMessage}</div>
				</td>
			</tr>
		</table>
	` : '';

	const attendeeNotesSection = data.attendeeNotes
		? generateYourMessageCard(data.attendeeNotes)
		: '';

	const meetingLabel = data.meetingType === 'teams' ? 'Join Microsoft Teams' : 'Join Google Meet Session';
	const actionButton = data.meetingUrl
		? generateActionButton(data.meetingUrl, meetingLabel, brandColor)
		: '';

	const managementLinks = generateManagementLinks(rescheduleUrl, cancelUrl, brandColor)
		.replace('Reschedule Time', 'Reschedule Again');

	const bodyContent = `
		<p style="margin: 0 0 16px; color: #e4e4e7; font-size: 15px; line-height: 24px;">
			Hi <strong style="color: #ffffff;">${data.attendeeName}</strong>,
		</p>
		<p style="margin: 0 0 24px; color: #d4d4d8; font-size: 15px; line-height: 24px;">
			Your consultation with <strong style="color: #ffffff;">${data.hostName}</strong> has been updated with a new date or time.
		</p>

		${customMessageSection}
		${attendeeNotesSection}

		<!-- Previous time (crossed out) -->
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; background-color: #1a1518; border-radius: 12px; border: 1px solid #3d1d23; margin-bottom: 12px;">
			<tr>
				<td style="padding: 16px 20px;">
					<div style="color: #f87171; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
						Previous Time (Cancelled)
					</div>
					<div style="color: #71717a; font-size: 15px; text-decoration: line-through;">
						${formatDate(data.oldStartTime)} at ${formatTime(data.oldStartTime)}
					</div>
				</td>
			</tr>
		</table>

		<!-- New confirmed time -->
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; background-color: #111e16; border-radius: 12px; border: 1px solid #1a422b; border-left: 4px solid #10b981; margin-bottom: 28px;">
			<tr>
				<td style="padding: 18px 20px;">
					<div style="color: #34d399; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
						New Confirmed Time
					</div>
					<div style="color: #ffffff; font-size: 18px; font-weight: 700;">
						📅 ${formatDate(data.startTime)}
					</div>
					<div style="color: #a7f3d0; font-size: 15px; font-weight: 600; margin-top: 2px;">
						⏰ ${formatTime(data.startTime)} - ${formatTime(data.endTime)}
					</div>
				</td>
			</tr>
		</table>

		${actionButton}
		${managementLinks}
	`;

	return generateBaseEmail({
		title: `Rescheduled: ${data.eventName} with ${data.hostName}`,
		badgeText: 'RESCHEDULED',
		badgeColor: '#f59e0b',
		badgeBg: 'rgba(245, 158, 11, 0.15)',
		headerContent,
		bodyContent,
		footerContent: `This is an automated reschedule notification for ${data.attendeeName}.`,
		hostName: data.hostName,
		brandColor
	});
}

/**
 * Generate admin/host reschedule notification email
 */
export function generateAdminRescheduleEmail(data: RescheduleEmailData): string {
	const { formatDate, formatTime } = createEmailFormatters(data.timeFormat, data.timezone);
	const brandColor = data.brandColor || '#2563eb';

	const headerContent = `
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
			<tr>
				<td align="center">
					<div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; text-align: center; background-color: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 50%; margin-bottom: 16px;">
						<span style="font-size: 24px; color: #f59e0b; line-height: 56px;">↻</span>
					</div>
					<h1 style="margin: 0 0 8px; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
						Booking Rescheduled
					</h1>
					<p style="margin: 0; color: #a1a1aa; font-size: 14px;">
						A client appointment was moved to a new slot.
					</p>
				</td>
			</tr>
		</table>
	`;

	const attendeeNotesSection = data.attendeeNotes
		? generateAttendeeNotesCard(data.attendeeName, data.attendeeNotes)
		: '';

	const adminMeetingLabel = data.meetingType === 'teams' ? 'Join Microsoft Teams' : 'Join Google Meet Session';
	const actionButton = data.meetingUrl
		? generateActionButton(data.meetingUrl, adminMeetingLabel, brandColor)
		: '';

	const bodyContent = `
		<p style="margin: 0 0 20px; color: #e4e4e7; font-size: 15px; line-height: 24px;">
			An appointment on your Neubofy portal has been rescheduled.
		</p>

		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; background-color: #18181f; border-radius: 12px; border: 1px solid #27272a; margin-bottom: 20px;">
			<tr>
				<td style="padding: 22px 24px;">
					<div style="margin-bottom: 12px;">
						<div style="color: #a1a1aa; font-size: 12px; font-weight: 600; text-transform: uppercase;">Client</div>
						<div style="color: #ffffff; font-size: 16px; font-weight: 600;">${data.attendeeName}</div>
						<div style="color: #71717a; font-size: 13px;">${data.attendeeEmail}</div>
					</div>

					<div>
						<div style="color: #a1a1aa; font-size: 12px; font-weight: 600; text-transform: uppercase;">Consultation Service</div>
						<div style="color: #ffffff; font-size: 15px; font-weight: 500;">${data.eventName}</div>
					</div>
				</td>
			</tr>
		</table>

		${attendeeNotesSection}

		<!-- Time Change Table -->
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
			<tr>
				<td width="48%" align="left" style="vertical-align: top; background-color: #1a1518; border-radius: 10px; border: 1px solid #3d1d23; padding: 14px 16px;">
					<div style="color: #f87171; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Old Slot</div>
					<div style="color: #71717a; font-size: 14px; text-decoration: line-through;">${formatDate(data.oldStartTime)}</div>
					<div style="color: #71717a; font-size: 13px; text-decoration: line-through;">${formatTime(data.oldStartTime)} - ${formatTime(data.oldEndTime)}</div>
				</td>
				<td width="4%" align="center" style="vertical-align: middle; color: #52525b; font-size: 18px;">
					→
				</td>
				<td width="48%" align="left" style="vertical-align: top; background-color: #111e16; border-radius: 10px; border: 1px solid #1a422b; padding: 14px 16px;">
					<div style="color: #34d399; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">New Slot</div>
					<div style="color: #ffffff; font-size: 14px; font-weight: 600;">${formatDate(data.startTime)}</div>
					<div style="color: #a7f3d0; font-size: 13px;">${formatTime(data.startTime)} - ${formatTime(data.endTime)}</div>
				</td>
			</tr>
		</table>

		${actionButton}
	`;

	return generateBaseEmail({
		title: `Rescheduled: ${data.eventName} - ${data.attendeeName}`,
		badgeText: 'SCHEDULE UPDATE',
		badgeColor: '#f59e0b',
		badgeBg: 'rgba(245, 158, 11, 0.15)',
		headerContent,
		bodyContent,
		footerContent: `Specialist schedule alert for ${data.hostName}.`,
		hostName: data.hostName,
		brandColor
	});
}
