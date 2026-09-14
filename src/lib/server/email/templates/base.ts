/**
 * Base email template structure - Neubofy Premium Dark Theme
 */

export interface BaseTemplateOptions {
	title: string;
	badgeText?: string;
	badgeColor?: string;
	badgeBg?: string;
	headerGradient?: string;
	headerContent: string;
	bodyContent: string;
	footerContent: string;
	hostName: string;
	brandColor?: string;
}

/**
 * Generate base HTML email structure compatible with all major email clients (Gmail, Outlook, Apple Mail)
 */
export function generateBaseEmail(options: BaseTemplateOptions): string {
	const brandColor = options.brandColor || '#2563eb';
	const badgeText = options.badgeText || '';
	const badgeColor = options.badgeColor || '#38bdf8';
	const badgeBg = options.badgeBg || 'rgba(56, 189, 248, 0.15)';

	return `
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${options.title}</title>
	<!--[if mso]>
	<noscript>
		<xml>
			<o:OfficeDocumentSettings>
				<o:PixelsPerInch>96</o:PixelsPerInch>
			</o:OfficeDocumentSettings>
		</xml>
	</noscript>
	<![endif]-->
	<style>
		body {
			margin: 0;
			padding: 0;
			-webkit-text-size-adjust: 100%;
			-ms-text-size-adjust: 100%;
			background-color: #09090b;
			color: #e4e4e7;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
		}
		table {
			border-collapse: collapse;
			mso-table-lspace: 0pt;
			mso-table-rspace: 0pt;
		}
		td {
			padding: 0;
		}
		img {
			border: 0;
			height: auto;
			line-height: 100%;
			outline: none;
			text-decoration: none;
		}
		a {
			color: #3b82f6;
			text-decoration: none;
		}
	</style>
</head>
<body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e4e4e7;">
	<!-- Outer wrapper table -->
	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; background-color: #09090b; margin: 0; padding: 0;">
		<tr>
			<td align="center" style="padding: 32px 16px 48px;">
				<!-- Main Email Card (Max 600px) -->
				<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #121216; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);">
					
					<!-- Top Neubofy Brand Bar -->
					<tr>
						<td style="padding: 24px 32px 16px; background-color: #0c0d12; border-bottom: 1px solid #1e2029;">
							<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
								<tr>
									<td align="left" style="vertical-align: middle;">
										<div style="font-size: 18px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff; text-transform: uppercase;">
											NEUBOFY<span style="color: #3b82f6;">.</span>
										</div>
										<div style="font-size: 11px; color: #71717a; letter-spacing: 0.5px; text-transform: uppercase; margin-top: 2px;">
											Expert Consultation Portal
										</div>
									</td>
									${badgeText ? `
									<td align="right" style="vertical-align: middle;">
										<span style="display: inline-block; padding: 4px 10px; border-radius: 9999px; background-color: ${badgeBg}; color: ${badgeColor}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid ${badgeColor}33;">
											${badgeText}
										</span>
									</td>
									` : ''}
								</tr>
							</table>
						</td>
					</tr>

					<!-- Header Visual / Announcement Area -->
					<tr>
						<td style="padding: 36px 32px 24px; text-align: center; background: ${options.headerGradient || 'linear-gradient(180deg, #161822 0%, #121216 100%)'}; border-bottom: 1px solid #1e2029;">
							${options.headerContent}
						</td>
					</tr>

					<!-- Main Body Content -->
					<tr>
						<td style="padding: 32px; background-color: #121216; color: #e4e4e7; font-size: 15px; line-height: 24px;">
							${options.bodyContent}
						</td>
					</tr>

					<!-- Footer Area -->
					<tr>
						<td style="padding: 24px 32px; background-color: #0c0d12; border-top: 1px solid #1e2029; text-align: center;">
							<p style="margin: 0 0 8px; color: #71717a; font-size: 12px; line-height: 18px;">
								${options.footerContent}
							</p>
							<p style="margin: 0; color: #52525b; font-size: 11px;">
								Powered by <a href="https://neubofy.in" style="color: #60a5fa; font-weight: 600; text-decoration: none;">Neubofy™</a> &bull; Verified Organization Services
							</p>
						</td>
					</tr>
				</table>

				<!-- Sub-footer info -->
				<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; margin-top: 16px;">
					<tr>
						<td align="center" style="color: #52525b; font-size: 11px; line-height: 16px;">
							This is a secure automated notification from Neubofy Consultation Platform.<br>
							Please do not reply directly to this automated address unless instructed.
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>
	`.trim();
}

/**
 * Generate meeting details card
 */
export function generateMeetingDetailsCard(options: {
	eventName: string;
	eventDescription?: string;
	formattedDate: string;
	formattedTime: string;
	meetingUrl?: string | null;
	meetingType?: 'google_meet' | 'teams';
	brandColor?: string;
}): string {
	const { eventName, eventDescription, formattedDate, formattedTime, meetingUrl, meetingType = 'google_meet', brandColor = '#2563eb' } = options;
	const meetingLabel = meetingType === 'teams' ? 'Microsoft Teams' : 'Google Meet';

	return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; background-color: #18181f; border-radius: 12px; border: 1px solid #27272a; border-left: 4px solid #3b82f6; margin-bottom: 28px;">
	<tr>
		<td style="padding: 22px 24px;">
			<div style="color: #3b82f6; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
				Consultation Details
			</div>

			<!-- Event Name -->
			<div style="margin-bottom: 14px;">
				<div style="color: #a1a1aa; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;">Topic / Service</div>
				<div style="color: #ffffff; font-size: 17px; font-weight: 700; line-height: 22px;">${eventName}</div>
				${eventDescription ? `<div style="color: #a1a1aa; font-size: 13px; margin-top: 5px; line-height: 18px;">${eventDescription}</div>` : ''}
			</div>

			<!-- Date & Time Row (Two Column on desktop) -->
			<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 14px;">
				<tr>
					<td width="50%" align="left" style="vertical-align: top; padding-right: 8px;">
						<div style="color: #a1a1aa; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;">Date</div>
						<div style="color: #ffffff; font-size: 15px; font-weight: 600;">📅 ${formattedDate}</div>
					</td>
					<td width="50%" align="left" style="vertical-align: top; padding-left: 8px;">
						<div style="color: #a1a1aa; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;">Time</div>
						<div style="color: #ffffff; font-size: 15px; font-weight: 600;">⏰ ${formattedTime}</div>
					</td>
				</tr>
			</table>

			${meetingUrl ? `
			<!-- Location / Link -->
			<div style="padding-top: 12px; border-top: 1px solid #27272a;">
				<div style="color: #a1a1aa; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Meeting Room</div>
				<a href="${meetingUrl}" target="_blank" style="color: #60a5fa; font-size: 14px; font-weight: 600; text-decoration: underline;">
					📹 ${meetingLabel} Link
				</a>
			</div>
			` : ''}
		</td>
	</tr>
</table>
	`.trim();
}

/**
 * Generate attendee notes card for admin emails (shows "Message from {name}")
 */
export function generateAttendeeNotesCard(attendeeName: string, notes: string): string {
	return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; background-color: #1a1b26; border-radius: 12px; border: 1px solid #2e3456; border-left: 4px solid #6366f1; margin-bottom: 28px;">
	<tr>
		<td style="padding: 18px 22px;">
			<div style="color: #818cf8; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
				Message from ${attendeeName}:
			</div>
			<div style="color: #e0e7ff; font-size: 14px; line-height: 22px; font-style: italic;">
				&ldquo;${notes}&rdquo;
			</div>
		</td>
	</tr>
</table>
	`.trim();
}

/**
 * Generate attendee notes card for client emails (shows "Your message")
 */
export function generateYourMessageCard(notes: string): string {
	return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; background-color: #1a1b26; border-radius: 12px; border: 1px solid #2e3456; border-left: 4px solid #6366f1; margin-bottom: 28px;">
	<tr>
		<td style="padding: 18px 22px;">
			<div style="color: #818cf8; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
				Your Intake Notes / Goals:
			</div>
			<div style="color: #e0e7ff; font-size: 14px; line-height: 22px; font-style: italic;">
				&ldquo;${notes}&rdquo;
			</div>
		</td>
	</tr>
</table>
	`.trim();
}

/**
 * Generate primary action button (Bulletproof button for emails)
 */
export function generateActionButton(url: string, text: string, brandColor: string = '#2563eb'): string {
	return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
	<tr>
		<td align="center">
			<!--[if mso]>
			<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="18%" stroke="f" fillcolor="${brandColor}">
				<w:anchorlock/>
				<center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">${text}</center>
			</v:roundrect>
			<![endif]-->
			<!--[if !mso]><!-- -->
			<a href="${url}" target="_blank" style="display: inline-block; padding: 14px 34px; background-color: ${brandColor}; background-image: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; letter-spacing: 0.2px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4); text-align: center;">
				${text}
			</a>
			<!--<![endif]-->
		</td>
	</tr>
</table>
	`.trim();
}

/**
 * Generate management links (reschedule/cancel)
 */
export function generateManagementLinks(rescheduleUrl: string, cancelUrl: string, brandColor: string = '#2563eb'): string {
	return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
	<tr>
		<td align="center" style="padding: 12px; background-color: #18181f; border-radius: 10px; border: 1px solid #27272a;">
			<table role="presentation" cellpadding="0" cellspacing="0" border="0">
				<tr>
					<td align="center" style="padding: 0 12px;">
						<a href="${rescheduleUrl}" style="color: #60a5fa; text-decoration: none; font-size: 13px; font-weight: 600;">
							↻ Reschedule Time
						</a>
					</td>
					<td align="center" style="color: #3f3f46; font-size: 13px;">|</td>
					<td align="center" style="padding: 0 12px;">
						<a href="${cancelUrl}" style="color: #f87171; text-decoration: none; font-size: 13px; font-weight: 600;">
							✕ Cancel Appointment
						</a>
					</td>
				</tr>
			</table>
		</td>
	</tr>
</table>
	`.trim();
}
