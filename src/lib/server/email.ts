/**
 * Email service - re-exports from modular email module
 *
 * This file maintains backward compatibility by re-exporting from the new
 * modular email structure in src/lib/server/email/
 */

export {
	// Types
	type BookingEmailData,
	type RescheduleEmailData,
	type EmailTemplate,
	type EmailTemplateType,
	// Formatters
	createEmailFormatters,
	replaceSubjectVariables,
	// Template generators
	generateBookingEmail,
	generateBookingEmailText,
	generateCancellationEmail,
	generateAdminCancellationEmail,
	generateRescheduleEmail,
	generateAdminRescheduleEmail,
	generateAdminNotificationEmail,
	// Send functions
	sendBookingEmail,
	sendCancellationEmail,
	sendRescheduleEmail,
	sendAdminNotificationEmail,
	sendAdminCancellationNotification,
	sendAdminRescheduleNotification,
	// Database functions
	getEmailTemplates,
	isEmailEnabled,
	getOrganizationEmailConfig,
	sendOrganizationInvitationEmail,
	// Contextual routing helpers
	getSenderEmail,
	getReplyToEmail,
	type EmailPurpose,
	type EmailConfig
} from './email/index';
