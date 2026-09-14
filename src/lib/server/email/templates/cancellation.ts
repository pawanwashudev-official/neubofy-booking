/**
 * Cancellation email templates - Neubofy Premium Dark Theme
 */

import type { BookingEmailData } from '../types';
import { createEmailFormatters } from '../formatters';
import { generateBaseEmail, generateActionButton } from './base';

/**
 * Generate HTML email for attendee cancellation notification
 */
export function generateCancellationEmail(data: BookingEmailData): string {
	const { formatDate, formatTime } = createEmailFormatters(data.timeFormat, data.timezone);
	const brandColor = data.brandColor || '#2563eb';

	const headerContent = `
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
			<tr>
				<td align="center">
					<div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; text-align: center; background-color: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 50%; margin-bottom: 16px;">
						<span style="font-size: 24px; color: #ef4444; line-height: 56px;">✕</span>
					</div>
					<h1 style="margin: 0 0 8px; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
						Meeting Cancelled
					</h1>
					<p style="margin: 0; color: #a1a1aa; font-size: 14px;">
						This appointment has been removed from the schedule.
					</p>
				</td>
			</tr>
		</table>
	`;

	const customMessageSection = data.customMessage ? `
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #1a1518; border-radius: 12px; border: 1px solid #3d1d23; border-left: 4px solid #ef4444; margin-bottom: 24px;">
			<tr>
				<td style="padding: 16px 20px;">
					<div style="color: #f87171; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Reason / Message:</div>
					<div style="color: #fca5a5; font-size: 14px; line-height: 20px;">${data.customMessage}</div>
				</td>
			</tr>
		</table>
	` : '';

	const rebookUrl = `${data.appUrl}/${data.eventSlug || ''}`;
	const rebookButton = generateActionButton(rebookUrl, 'Book a New Time Slot', brandColor);

	const bodyContent = `
		<p style="margin: 0 0 16px; color: #e4e4e7; font-size: 15px; line-height: 24px;">
			Hi <strong style="color: #ffffff;">${data.attendeeName}</strong>,
		</p>
		<p style="margin: 0 0 24px; color: #d4d4d8; font-size: 15px; line-height: 24px;">
			Your scheduled consultation with <strong style="color: #ffffff;">${data.hostName}</strong> has been cancelled.
		</p>

		${customMessageSection}

		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; background-color: #18181f; border-radius: 12px; border: 1px solid #27272a; margin-bottom: 28px;">
			<tr>
				<td style="padding: 20px 24px;">
					<div style="color: #71717a; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
						Cancelled Booking Info
					</div>
					<div style="margin-bottom: 10px;">
						<div style="color: #a1a1aa; font-size: 12px; font-weight: 600; text-transform: uppercase;">Service</div>
						<div style="color: #71717a; font-size: 15px; font-weight: 600; text-decoration: line-through;">${data.eventName}</div>
					</div>
					<div>
						<div style="color: #a1a1aa; font-size: 12px; font-weight: 600; text-transform: uppercase;">Originally Scheduled</div>
						<div style="color: #71717a; font-size: 14px; text-decoration: line-through;">${formatDate(data.startTime)} at ${formatTime(data.startTime)}</div>
					</div>
				</td>
			</tr>
		</table>

		<p style="margin: 0 0 20px; color: #a1a1aa; font-size: 14px; text-align: center;">
			Would you like to find another suitable date and time?
		</p>

		${rebookButton}
	`;

	return generateBaseEmail({
		title: `Cancelled: ${data.eventName} with ${data.hostName}`,
		badgeText: 'CANCELLED',
		badgeColor: '#ef4444',
		badgeBg: 'rgba(239, 68, 68, 0.15)',
		headerContent,
		bodyContent,
		footerContent: `This is an automated cancellation notice for ${data.attendeeName}.`,
		hostName: data.hostName,
		brandColor
	});
}

/**
 * Generate admin/host cancellation notification email
 */
export function generateAdminCancellationEmail(data: BookingEmailData): string {
	const { formatDate, formatTime } = createEmailFormatters(data.timeFormat, data.timezone);

	const customMessageSection = data.customMessage ? `
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #1a1518; border-radius: 12px; border: 1px solid #3d1d23; border-left: 4px solid #ef4444; margin-bottom: 24px;">
			<tr>
				<td style="padding: 16px 20px;">
					<div style="color: #f87171; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Reason provided:</div>
					<div style="color: #fca5a5; font-size: 14px; line-height: 20px;">${data.customMessage}</div>
				</td>
			</tr>
		</table>
	` : '';

	const headerContent = `
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
			<tr>
				<td align="center">
					<div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; text-align: center; background-color: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 50%; margin-bottom: 16px;">
						<span style="font-size: 24px; color: #ef4444; line-height: 56px;">✕</span>
					</div>
					<h1 style="margin: 0 0 8px; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
						Session Cancelled
					</h1>
					<p style="margin: 0; color: #a1a1aa; font-size: 14px;">
						An appointment has been removed from your portal schedule.
					</p>
				</td>
			</tr>
		</table>
	`;

	const bodyContent = `
		<p style="margin: 0 0 20px; color: #e4e4e7; font-size: 15px; line-height: 24px;">
			A client consultation has been marked as cancelled. Your availability slot is now reopened.
		</p>

		${customMessageSection}

		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; background-color: #18181f; border-radius: 12px; border: 1px solid #27272a; margin-bottom: 24px;">
			<tr>
				<td style="padding: 22px 24px;">
					<div style="margin-bottom: 12px;">
						<div style="color: #a1a1aa; font-size: 12px; font-weight: 600; text-transform: uppercase;">Client</div>
						<div style="color: #ffffff; font-size: 16px; font-weight: 600;">${data.attendeeName}</div>
						<div style="color: #71717a; font-size: 13px;">${data.attendeeEmail}</div>
					</div>

					<div style="margin-bottom: 12px;">
						<div style="color: #a1a1aa; font-size: 12px; font-weight: 600; text-transform: uppercase;">Consultation Service</div>
						<div style="color: #ffffff; font-size: 15px; font-weight: 500;">${data.eventName}</div>
					</div>

					<div>
						<div style="color: #a1a1aa; font-size: 12px; font-weight: 600; text-transform: uppercase;">Originally Scheduled</div>
						<div style="color: #71717a; font-size: 14px; text-decoration: line-through;">${formatDate(data.startTime)} (${formatTime(data.startTime)} - ${formatTime(data.endTime)})</div>
					</div>
				</td>
			</tr>
		</table>
	`;

	return generateBaseEmail({
		title: `Cancelled: ${data.eventName} - ${data.attendeeName}`,
		badgeText: 'PORTAL ALERT',
		badgeColor: '#ef4444',
		badgeBg: 'rgba(239, 68, 68, 0.15)',
		headerContent,
		bodyContent,
		footerContent: `Neubofy Specialist Notification for ${data.hostName}.`,
		hostName: data.hostName
	});
}
