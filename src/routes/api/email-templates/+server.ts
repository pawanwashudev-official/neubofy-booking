/**
 * Email Templates API endpoint
 * Manages email template settings (enable/disable, custom subjects, messages)
 */

import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getAuthContext, isOrganizationAdmin } from '$lib/server/auth';

export interface EmailTemplate {
	id: string;
	template_type: string;
	is_enabled: number;
	subject: string | null;
	custom_message: string | null;
}

// Default templates with descriptions
const DEFAULT_TEMPLATES = [
	{
		template_type: 'confirmation',
		name: 'Booking Confirmation',
		description: 'Sent when someone books a meeting with you',
		default_subject: 'Meeting Confirmed: {event_name} with {host_name}'
	},
	{
		template_type: 'cancellation',
		name: 'Cancellation Notice',
		description: 'Sent when a meeting is cancelled',
		default_subject: 'Meeting Cancelled: {event_name}'
	},
	{
		template_type: 'reschedule',
		name: 'Reschedule Confirmation',
		description: 'Sent when a meeting is rescheduled',
		default_subject: 'Meeting Rescheduled: {event_name} with {host_name}'
	},
	{
		template_type: 'reminder_24h',
		name: '24 Hour Reminder',
		description: 'Sent 24 hours before the meeting',
		default_subject: 'Reminder: {event_name} tomorrow with {host_name}'
	},
	{
		template_type: 'reminder_1h',
		name: '1 Hour Reminder',
		description: 'Sent 1 hour before the meeting',
		default_subject: 'Reminder: {event_name} starts in 1 hour'
	}
];

export const GET = async (event: RequestEvent) => {
	const auth = await getAuthContext(event);
	if (!auth) {
		throw error(401, 'Unauthorized');
	}
	if (!isOrganizationAdmin(auth.role)) throw error(403, 'Organization administrator access required');

	const env = event.platform?.env;
	if (!env) {
		throw error(500, 'Platform env not available');
	}

	const db = env.DB;

	try {
		// Email templates belong to the organization, not the signed-in member.
		const templates = await db
			.prepare('SELECT id, template_type, is_enabled, subject, custom_message FROM email_templates WHERE organization_id = ?')
			.bind(auth.organizationId)
			.all<EmailTemplate>();

		// Merge with defaults (templates that don't exist in DB yet)
		const templateMap = new Map(templates.results.map(t => [t.template_type, t]));

		const result = DEFAULT_TEMPLATES.map(def => {
			const saved = templateMap.get(def.template_type);
			return {
				...def,
				id: saved?.id || null,
				is_enabled: saved ? saved.is_enabled === 1 : true,
				subject: saved?.subject || def.default_subject,
				custom_message: saved?.custom_message || null
			};
		});

		return json({ templates: result });
	} catch (err: any) {
		console.error('Email templates GET error:', err);
		throw error(500, 'Failed to fetch email templates');
	}
};

export const PUT = async (event: RequestEvent) => {
	const auth = await getAuthContext(event);
	if (!auth) {
		throw error(401, 'Unauthorized');
	}
	if (!isOrganizationAdmin(auth.role)) throw error(403, 'Organization administrator access required');

	const env = event.platform?.env;
	if (!env) {
		throw error(500, 'Platform env not available');
	}

	const db = env.DB;

	try {
		const body = await event.request.json() as {
			template_type: string;
			is_enabled: boolean;
			subject?: string | null;
			custom_message?: string | null;
		};
		const { template_type, is_enabled, subject, custom_message } = body;

		// Validate template type
		const validTypes = DEFAULT_TEMPLATES.map(t => t.template_type);
		if (!validTypes.includes(template_type)) {
			throw error(400, 'Invalid template type');
		}

		const existing = await db.prepare('SELECT id FROM email_templates WHERE organization_id = ? AND template_type = ? LIMIT 1')
			.bind(auth.organizationId, template_type).first<{ id: string }>();
		if (existing) {
			await db.prepare(
				`UPDATE email_templates SET is_enabled = ?, subject = ?, custom_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
			).bind(is_enabled ? 1 : 0, subject || null, custom_message || null, existing.id).run();
		} else {
			await db.prepare(
				`INSERT INTO email_templates (user_id, organization_id, template_type, is_enabled, subject, custom_message, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
			).bind(auth.userId, auth.organizationId, template_type, is_enabled ? 1 : 0, subject || null, custom_message || null).run();
		}

		return json({ success: true });
	} catch (err: any) {
		console.error('Email templates PUT error:', err);
		if (err?.status) throw err;
		throw error(500, 'Failed to update email template');
	}
};
