/**
 * Email service using Resend API (https://resend.com)
 *
 * This is the main entry point for the email module.
 * It re-exports types, formatters, and templates, and provides send functions.
 */

// Re-export types
export type { BookingEmailData, RescheduleEmailData, EmailTemplate, EmailTemplateType } from './types';

// Re-export formatters
export { createEmailFormatters, replaceSubjectVariables } from './formatters';

// Re-export template generators
export {
	generateBookingEmail,
	generateBookingEmailText,
	generateCancellationEmail,
	generateAdminCancellationEmail,
	generateRescheduleEmail,
	generateAdminRescheduleEmail,
	generateAdminNotificationEmail
} from './templates';

import type { BookingEmailData, RescheduleEmailData, EmailTemplate, EmailTemplateType } from './types';
import { replaceSubjectVariables } from './formatters';
import {
	generateBookingEmail,
	generateBookingEmailText,
	generateCancellationEmail,
	generateAdminCancellationEmail,
	generateRescheduleEmail,
	generateAdminRescheduleEmail,
	generateAdminNotificationEmail
} from './templates';

/**
 * Email configuration for sending
 */
export interface EmailConfig {
	apiKey: string;
	from: string;
	replyTo?: string;
}

export type EmailPurpose =
	| 'booking'
	| 'reschedule'
	| 'cancellation'
	| 'otp'
	| 'admin_notification'
	| 'invitation';

/**
 * Derives a clean, contextual "From" header retaining the verified @updates.neubofy.in domain
 */
export function getSenderEmail(purpose: EmailPurpose, baseFrom?: string, hostOrOrgName?: string): string {
	const defaultDomain = '@updates.neubofy.in';
	let mailbox = 'booking';
	let displayName = hostOrOrgName ? `${hostOrOrgName} via Neubofy` : 'Neubofy Consultations';

	switch (purpose) {
		case 'otp':
			mailbox = 'otp';
			displayName = 'Neubofy Security';
			break;
		case 'reschedule':
			mailbox = 'scheduling';
			displayName = hostOrOrgName ? `${hostOrOrgName} via Neubofy Scheduling` : 'Neubofy Scheduling';
			break;
		case 'cancellation':
			mailbox = 'scheduling';
			displayName = 'Neubofy Scheduling';
			break;
		case 'admin_notification':
			mailbox = 'notifications';
			displayName = 'Neubofy Booking Alerts';
			break;
		case 'invitation':
			mailbox = 'team';
			displayName = hostOrOrgName || 'Neubofy Team';
			break;
		case 'booking':
		default:
			mailbox = 'booking';
			displayName = hostOrOrgName ? `${hostOrOrgName} via Neubofy` : 'Neubofy Strategy Consultations';
			break;
	}

	// If custom non-default sender was configured in organization settings and doesn't use updates.neubofy.in
	if (baseFrom && !baseFrom.includes('updates.neubofy.in') && baseFrom.includes('@')) {
		// Extract raw email if it was enclosed in brackets
		const rawEmail = baseFrom.includes('<') ? baseFrom.replace(/^.*<([^>]+)>.*$/, '$1') : baseFrom;
		return `${displayName} <${rawEmail}>`;
	}

	return `${displayName} <${mailbox}${defaultDomain}>`;
}

/**
 * Derives a contextual "Reply-To" address based on the intent of the email
 */
export function getReplyToEmail(purpose: EmailPurpose, customReplyTo?: string): string {
	if (customReplyTo && customReplyTo.trim() && !customReplyTo.includes('example.com')) {
		return customReplyTo.trim();
	}

	switch (purpose) {
		case 'otp':
		case 'cancellation':
		case 'admin_notification':
			return 'support@neubofy.in';
		case 'invitation':
			return 'contact@neubofy.in';
		case 'booking':
		case 'reschedule':
		default:
			return 'meet@neubofy.in';
	}
}

export async function getOrganizationEmailConfig(
	db: D1Database,
	userId: string,
	env: { EMAIL_FROM?: string; EMAIL_REPLY_TO?: string }
): Promise<{ from: string; replyTo: string }> {
	const organization = await db.prepare(
		`SELECT o.email_from, o.reply_to_email, o.contact_email
		 FROM organizations o JOIN organization_members m ON m.organization_id = o.id
		 WHERE m.user_id = ? AND m.is_active = 1 LIMIT 1`
	).bind(userId).first<{ email_from: string | null; reply_to_email: string | null; contact_email: string | null }>();
	return {
		from: organization?.email_from || env.EMAIL_FROM || 'booking@updates.neubofy.in',
		replyTo: organization?.reply_to_email || organization?.contact_email || env.EMAIL_REPLY_TO || 'meet@neubofy.in'
	};
}

export async function sendOrganizationInvitationEmail(
	data: { organizationName: string; inviteeEmail: string; role: string; invitationUrl: string },
	config: EmailConfig & { replyTo: string }
): Promise<void> {
	const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a">
		<div style="padding:28px 24px;background:#2563eb;color:#fff;border-radius:12px 12px 0 0">
			<p style="margin:0 0 8px;font-size:12px;letter-spacing:1px;text-transform:uppercase">${data.organizationName}</p>
			<h1 style="margin:0;font-size:26px">You are invited to join the team</h1>
		</div>
		<div style="padding:28px 24px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 12px 12px">
			<p>You have been invited to join <strong>${data.organizationName}</strong> as an ${data.role === 'admin' ? 'administrator' : 'team member'}.</p>
			<p>Sign in with this email address to accept the invitation and access your portal.</p>
			<p style="margin:28px 0"><a href="${data.invitationUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:13px 20px;border-radius:8px;font-weight:600">Accept invitation</a></p>
			<p style="font-size:13px;color:#64748b">If you were not expecting this invitation, you can safely ignore this email.</p>
		</div>
</div>`;
	const response = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
		body: JSON.stringify({
			from: getSenderEmail('invitation', config.from, data.organizationName),
			to: data.inviteeEmail,
			reply_to: getReplyToEmail('invitation', config.replyTo),
			subject: `You are invited to join ${data.organizationName}`,
			html
		})
	});
	if (!response.ok) throw new Error(`Failed to send invitation email: ${await response.text()}`);
}

/**
 * Send booking confirmation email via Resend API
 */
export async function sendBookingEmail(
	data: BookingEmailData,
	config: EmailConfig & { replyTo: string },
	customSubject?: string
): Promise<void> {
	const htmlBody = generateBookingEmail(data);
	const textBody = generateBookingEmailText(data);
	const subject = customSubject
		? replaceSubjectVariables(customSubject, data)
		: `Meeting Confirmed: ${data.eventName} with ${data.hostName}`;

	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${config.apiKey}`
			},
			body: JSON.stringify({
				from: getSenderEmail('booking', config.from, data.hostName),
				to: data.attendeeEmail,
				reply_to: getReplyToEmail('booking', config.replyTo),
				subject,
				text: textBody,
				html: htmlBody
			})
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to send email: ${error}`);
		}
	} catch (error) {
		console.error('Email sending error:', error);
		throw error;
	}
}

/**
 * Send cancellation email
 */
export async function sendCancellationEmail(
	data: BookingEmailData,
	config: EmailConfig & { replyTo: string },
	customSubject?: string
): Promise<void> {
	const htmlBody = generateCancellationEmail(data);
	const subject = customSubject
		? replaceSubjectVariables(customSubject, data)
		: `Meeting Cancelled: ${data.eventName}`;

	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${config.apiKey}`
			},
			body: JSON.stringify({
				from: getSenderEmail('cancellation', config.from, data.hostName),
				to: data.attendeeEmail,
				reply_to: getReplyToEmail('cancellation', config.replyTo),
				subject,
				html: htmlBody
			})
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to send cancellation email: ${error}`);
		}
	} catch (error) {
		console.error('Cancellation email error:', error);
		throw error;
	}
}

/**
 * Send reschedule email
 */
export async function sendRescheduleEmail(
	data: RescheduleEmailData,
	config: EmailConfig & { replyTo: string },
	customSubject?: string
): Promise<void> {
	const htmlBody = generateRescheduleEmail(data);
	const subject = customSubject
		? replaceSubjectVariables(customSubject, data)
		: `Meeting Rescheduled: ${data.eventName} with ${data.hostName}`;

	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${config.apiKey}`
			},
			body: JSON.stringify({
				from: getSenderEmail('reschedule', config.from, data.hostName),
				to: data.attendeeEmail,
				reply_to: getReplyToEmail('reschedule', config.replyTo),
				subject,
				html: htmlBody
			})
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to send reschedule email: ${error}`);
		}
	} catch (error) {
		console.error('Reschedule email error:', error);
		throw error;
	}
}


/**
 * Send admin notification email when a booking is made
 */
export async function sendAdminNotificationEmail(
	data: BookingEmailData,
	adminEmail: string,
	config: EmailConfig
): Promise<void> {
	const htmlBody = generateAdminNotificationEmail(data);

	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${config.apiKey}`
			},
			body: JSON.stringify({
				from: getSenderEmail('admin_notification', config.from),
				to: adminEmail,
				reply_to: getReplyToEmail('admin_notification'),
				subject: `New Booking: ${data.eventName} with ${data.attendeeName}`,
				html: htmlBody
			})
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to send admin notification: ${error}`);
		}
	} catch (error) {
		console.error('Admin notification email error:', error);
		throw error;
	}
}

/**
 * Send admin notification for cancellation
 */
export async function sendAdminCancellationNotification(
	data: BookingEmailData,
	adminEmail: string,
	config: EmailConfig
): Promise<void> {
	const htmlBody = generateAdminCancellationEmail(data);

	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${config.apiKey}`
			},
			body: JSON.stringify({
				from: getSenderEmail('admin_notification', config.from),
				to: adminEmail,
				reply_to: getReplyToEmail('admin_notification'),
				subject: `Booking Cancelled: ${data.eventName} with ${data.attendeeName}`,
				html: htmlBody
			})
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to send admin cancellation notification: ${error}`);
		}
	} catch (error) {
		console.error('Admin cancellation notification error:', error);
		throw error;
	}
}

/**
 * Send admin notification for reschedule
 */
export async function sendAdminRescheduleNotification(
	data: RescheduleEmailData,
	adminEmail: string,
	config: EmailConfig
): Promise<void> {
	const htmlBody = generateAdminRescheduleEmail(data);

	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${config.apiKey}`
			},
			body: JSON.stringify({
				from: getSenderEmail('admin_notification', config.from),
				to: adminEmail,
				reply_to: getReplyToEmail('admin_notification'),
				subject: `Booking Rescheduled: ${data.eventName} with ${data.attendeeName}`,
				html: htmlBody
			})
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to send admin reschedule notification: ${error}`);
		}
	} catch (error) {
		console.error('Admin reschedule notification error:', error);
		throw error;
	}
}

/**
 * Get email templates for a user
 */
export async function getEmailTemplates(
	db: D1Database,
	userId: string
): Promise<Map<EmailTemplateType, EmailTemplate>> {
	const templates = await db
		.prepare(
			`SELECT et.template_type, et.is_enabled, et.subject, et.custom_message
			 FROM email_templates et
			 JOIN organization_members om ON om.organization_id = et.organization_id AND om.user_id = ? AND om.is_active = 1
			 WHERE et.organization_id = om.organization_id`
		)
		.bind(userId)
		.all<{
			template_type: EmailTemplateType;
			is_enabled: number;
			subject: string | null;
			custom_message: string | null;
		}>();

	const map = new Map<EmailTemplateType, EmailTemplate>();
	for (const t of templates.results) {
		map.set(t.template_type, {
			template_type: t.template_type,
			is_enabled: t.is_enabled === 1,
			subject: t.subject,
			custom_message: t.custom_message
		});
	}
	return map;
}

/**
 * Check if a specific email type is enabled
 */
export function isEmailEnabled(
	templates: Map<EmailTemplateType, EmailTemplate>,
	type: EmailTemplateType
): boolean {
	const template = templates.get(type);
	// Default to enabled if no template exists
	return template ? template.is_enabled : true;
}
