/**
 * Reminder email templates - Neubofy Premium Dark Theme
 */

import type { BookingEmailData } from '../types';
import { createEmailFormatters } from '../formatters';
import { generateBaseEmail, generateActionButton, generateManagementLinks } from './base';

type ReminderType = 'reminder_24h' | 'reminder_1h' | 'reminder_30m';

const TIME_LABELS: Record<ReminderType, string> = {
	'reminder_24h': 'Tomorrow',
	'reminder_1h': 'in 1 Hour',
	'reminder_30m': 'in 30 Minutes'
};

const REMINDER_THEMES: Record<ReminderType, {
	badgeText: string;
	badgeColor: string;
	badgeBg: string;
	cardBg: string;
	cardBorder: string;
	textColor: string;
	timeColor: string;
}> = {
	'reminder_24h': {
		badgeText: 'STARTING TOMORROW',
		badgeColor: '#38bdf8',
		badgeBg: 'rgba(56, 189, 248, 0.15)',
		cardBg: '#101726',
		cardBorder: '#1e3a5f',
		textColor: '#93c5fd',
		timeColor: '#ffffff'
	},
	'reminder_1h': {
		badgeText: 'STARTING IN 1 HOUR',
		badgeColor: '#fbbf24',
		badgeBg: 'rgba(251, 191, 36, 0.15)',
		cardBg: '#1f170e',
		cardBorder: '#4a3314',
		textColor: '#fcd34d',
		timeColor: '#ffffff'
	},
	'reminder_30m': {
		badgeText: 'STARTING IN 30 MIN',
		badgeColor: '#f87171',
		badgeBg: 'rgba(248, 113, 113, 0.15)',
		cardBg: '#1c1315',
		cardBorder: '#4a1e23',
		textColor: '#fca5a5',
		timeColor: '#ffffff'
	}
};

/**
 * Generate HTML email for reminders
 */
export function generateReminderEmail(data: BookingEmailData, reminderType: ReminderType): string {
	const { formatDate, formatTime } = createEmailFormatters(data.timeFormat, data.timezone);
	const brandColor = data.brandColor || '#2563eb';

	const cancelUrl = `${data.appUrl}/cancel/${data.bookingId}`;
	const rescheduleUrl = `${data.appUrl}/reschedule/${data.bookingId}`;

	const theme = REMINDER_THEMES[reminderType];
	const timeLabel = TIME_LABELS[reminderType];

	const headerContent = `
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
			<tr>
				<td align="center">
					<div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; text-align: center; background-color: ${theme.badgeBg}; border: 1px solid ${theme.badgeColor}40; border-radius: 50%; margin-bottom: 16px;">
						<span style="font-size: 24px; line-height: 56px;">⏰</span>
					</div>
					<h1 style="margin: 0 0 8px; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
						Meeting ${timeLabel}!
					</h1>
					<p style="margin: 0; color: #a1a1aa; font-size: 14px;">
						Here is your quick reminder for your upcoming session.
					</p>
				</td>
			</tr>
		</table>
	`;

	const customMessageSection = data.customMessage ? `
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #1a1b26; border-radius: 12px; border: 1px solid #2e3456; border-left: 4px solid #3b82f6; margin-bottom: 24px;">
			<tr>
				<td style="padding: 16px 20px;">
					<div style="color: #60a5fa; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Host Note:</div>
					<div style="color: #e4e4e7; font-size: 14px; line-height: 20px;">${data.customMessage}</div>
				</td>
			</tr>
		</table>
	` : '';

	const meetingLabel = data.meetingType === 'teams' ? 'Join Microsoft Teams' : 'Join Google Meet';
	const actionButton = data.meetingUrl
		? generateActionButton(data.meetingUrl, meetingLabel, brandColor)
		: '';

	const managementLinks = generateManagementLinks(rescheduleUrl, cancelUrl, brandColor);

	const bodyContent = `
		<p style="margin: 0 0 16px; color: #e4e4e7; font-size: 15px; line-height: 24px;">
			Hi <strong style="color: #ffffff;">${data.attendeeName}</strong>,
		</p>
		<p style="margin: 0 0 24px; color: #d4d4d8; font-size: 15px; line-height: 24px;">
			This is a friendly reminder that your consultation with <strong style="color: #ffffff;">${data.hostName}</strong> is coming up ${timeLabel.toLowerCase()}.
		</p>

		${customMessageSection}

		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; background-color: ${theme.cardBg}; border-radius: 12px; border: 1px solid ${theme.cardBorder}; margin-bottom: 28px;">
			<tr>
				<td style="padding: 24px;">
					<div style="color: ${theme.textColor}; font-size: 12px; margin-bottom: 6px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
						${data.eventName}
					</div>
					<div style="color: ${theme.timeColor}; font-size: 20px; font-weight: 800; margin-bottom: 4px;">
						📅 ${formatDate(data.startTime)}
					</div>
					<div style="color: ${theme.textColor}; font-size: 16px; font-weight: 600;">
						⏰ ${formatTime(data.startTime)} - ${formatTime(data.endTime)}
					</div>
				</td>
			</tr>
		</table>

		${actionButton}
		${managementLinks}
	`;

	return generateBaseEmail({
		title: `Reminder: ${data.eventName} ${timeLabel}`,
		badgeText: theme.badgeText,
		badgeColor: theme.badgeColor,
		badgeBg: theme.badgeBg,
		headerContent,
		bodyContent,
		footerContent: `This is an automated reminder for ${data.attendeeName}.`,
		hostName: data.hostName,
		brandColor
	});
}

/**
 * Get default reminder subjects
 */
export function getDefaultReminderSubject(data: BookingEmailData, reminderType: ReminderType): string {
	const subjects: Record<ReminderType, string> = {
		'reminder_24h': `[Reminder] Tomorrow: ${data.eventName} with ${data.hostName}`,
		'reminder_1h': `[Reminder] Starting in 1 hour: ${data.eventName}`,
		'reminder_30m': `[Reminder] Starting soon (30m): ${data.eventName}`
	};
	return subjects[reminderType];
}
