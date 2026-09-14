/**
 * Comprehensive World Timezone Constants & Utilities
 * Provides IANA timezones, UTC offsets, live current time, and fuzzy search.
 */

export interface TimezoneOption {
	value: string;
	label: string;
	offsetLabel: string;
	region: string;
}

/**
 * Calculate the current UTC offset string for any IANA timezone (e.g., UTC+05:30, UTC-05:00)
 */
export function getUtcOffset(tz: string): string {
	try {
		const now = new Date();
		const formatter = new Intl.DateTimeFormat('en-US', {
			timeZone: tz,
			timeZoneName: 'shortOffset'
		});
		const parts = formatter.formatToParts(now);
		const tzPart = parts.find((p) => p.type === 'timeZoneName');
		if (tzPart && tzPart.value) {
			return tzPart.value.replace('GMT', 'UTC');
		}
		return 'UTC';
	} catch {
		return 'UTC';
	}
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
	// Popular & Asia
	{ value: 'Asia/Kolkata', label: 'India Standard Time (IST)', offsetLabel: 'UTC+05:30', region: 'Asia' },
	{ value: 'Asia/Dubai', label: 'Dubai / Gulf Standard Time', offsetLabel: 'UTC+04:00', region: 'Asia' },
	{ value: 'Asia/Singapore', label: 'Singapore Standard Time (SGT)', offsetLabel: 'UTC+08:00', region: 'Asia' },
	{ value: 'Asia/Hong_Kong', label: 'Hong Kong Time (HKT)', offsetLabel: 'UTC+08:00', region: 'Asia' },
	{ value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)', offsetLabel: 'UTC+09:00', region: 'Asia' },
	{ value: 'Asia/Seoul', label: 'Korea Standard Time (KST)', offsetLabel: 'UTC+09:00', region: 'Asia' },
	{ value: 'Asia/Bangkok', label: 'Indochina Time (ICT)', offsetLabel: 'UTC+07:00', region: 'Asia' },
	{ value: 'Asia/Jakarta', label: 'Western Indonesia Time (WIB)', offsetLabel: 'UTC+07:00', region: 'Asia' },
	{ value: 'Asia/Manila', label: 'Philippine Standard Time (PST)', offsetLabel: 'UTC+08:00', region: 'Asia' },
	{ value: 'Asia/Karachi', label: 'Pakistan Standard Time (PKT)', offsetLabel: 'UTC+05:00', region: 'Asia' },
	{ value: 'Asia/Dhaka', label: 'Bangladesh Standard Time (BST)', offsetLabel: 'UTC+06:00', region: 'Asia' },
	{ value: 'Asia/Colombo', label: 'Sri Lanka Standard Time (SLST)', offsetLabel: 'UTC+05:30', region: 'Asia' },
	{ value: 'Asia/Kathmandu', label: 'Nepal Time (NPT)', offsetLabel: 'UTC+05:45', region: 'Asia' },
	{ value: 'Asia/Shanghai', label: 'China Standard Time (CST)', offsetLabel: 'UTC+08:00', region: 'Asia' },
	{ value: 'Asia/Taipei', label: 'Taipei Time', offsetLabel: 'UTC+08:00', region: 'Asia' },
	{ value: 'Asia/Kuala_Lumpur', label: 'Malaysia Time', offsetLabel: 'UTC+08:00', region: 'Asia' },
	{ value: 'Asia/Riyadh', label: 'Arabia Standard Time (AST)', offsetLabel: 'UTC+03:00', region: 'Middle East' },
	{ value: 'Asia/Qatar', label: 'Qatar Time', offsetLabel: 'UTC+03:00', region: 'Middle East' },
	{ value: 'Asia/Jerusalem', label: 'Israel Standard Time (IST)', offsetLabel: 'UTC+02:00', region: 'Middle East' },

	// US & Canada
	{ value: 'America/New_York', label: 'Eastern Time (US & Canada)', offsetLabel: 'UTC-05:00', region: 'US/Canada' },
	{ value: 'America/Chicago', label: 'Central Time (US & Canada)', offsetLabel: 'UTC-06:00', region: 'US/Canada' },
	{ value: 'America/Denver', label: 'Mountain Time (US & Canada)', offsetLabel: 'UTC-07:00', region: 'US/Canada' },
	{ value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)', offsetLabel: 'UTC-08:00', region: 'US/Canada' },
	{ value: 'America/Anchorage', label: 'Alaska Time', offsetLabel: 'UTC-09:00', region: 'US/Canada' },
	{ value: 'Pacific/Honolulu', label: 'Hawaii-Aleutian Time', offsetLabel: 'UTC-10:00', region: 'US/Canada' },
	{ value: 'America/Phoenix', label: 'Arizona Time (MST)', offsetLabel: 'UTC-07:00', region: 'US/Canada' },
	{ value: 'America/Toronto', label: 'Toronto Time (EST)', offsetLabel: 'UTC-05:00', region: 'US/Canada' },
	{ value: 'America/Vancouver', label: 'Vancouver Time (PST)', offsetLabel: 'UTC-08:00', region: 'US/Canada' },
	{ value: 'America/Halifax', label: 'Atlantic Time', offsetLabel: 'UTC-04:00', region: 'US/Canada' },
	{ value: 'America/St_Johns', label: 'Newfoundland Time', offsetLabel: 'UTC-03:30', region: 'US/Canada' },

	// Europe
	{ value: 'Europe/London', label: 'Greenwich Mean Time / British Summer Time', offsetLabel: 'UTC+00:00', region: 'Europe' },
	{ value: 'Europe/Dublin', label: 'Ireland Time', offsetLabel: 'UTC+00:00', region: 'Europe' },
	{ value: 'Europe/Paris', label: 'Central European Time (Paris, Brussels)', offsetLabel: 'UTC+01:00', region: 'Europe' },
	{ value: 'Europe/Berlin', label: 'Berlin, Frankfurt, Munich', offsetLabel: 'UTC+01:00', region: 'Europe' },
	{ value: 'Europe/Amsterdam', label: 'Amsterdam Time', offsetLabel: 'UTC+01:00', region: 'Europe' },
	{ value: 'Europe/Rome', label: 'Rome, Milan', offsetLabel: 'UTC+01:00', region: 'Europe' },
	{ value: 'Europe/Madrid', label: 'Madrid, Barcelona', offsetLabel: 'UTC+01:00', region: 'Europe' },
	{ value: 'Europe/Zurich', label: 'Zurich, Geneva', offsetLabel: 'UTC+01:00', region: 'Europe' },
	{ value: 'Europe/Stockholm', label: 'Stockholm Time', offsetLabel: 'UTC+01:00', region: 'Europe' },
	{ value: 'Europe/Warsaw', label: 'Warsaw Time', offsetLabel: 'UTC+01:00', region: 'Europe' },
	{ value: 'Europe/Helsinki', label: 'Eastern European Time (Helsinki, Tallinn)', offsetLabel: 'UTC+02:00', region: 'Europe' },
	{ value: 'Europe/Athens', label: 'Athens, Bucharest', offsetLabel: 'UTC+02:00', region: 'Europe' },
	{ value: 'Europe/Istanbul', label: 'Turkey Time', offsetLabel: 'UTC+03:00', region: 'Europe' },
	{ value: 'Europe/Moscow', label: 'Moscow Standard Time', offsetLabel: 'UTC+03:00', region: 'Europe' },

	// Australia & Pacific
	{ value: 'Australia/Sydney', label: 'Sydney, Melbourne, Canberra (AEST)', offsetLabel: 'UTC+10:00', region: 'Australia' },
	{ value: 'Australia/Brisbane', label: 'Brisbane Time (AEST)', offsetLabel: 'UTC+10:00', region: 'Australia' },
	{ value: 'Australia/Adelaide', label: 'Adelaide Time (ACST)', offsetLabel: 'UTC+09:30', region: 'Australia' },
	{ value: 'Australia/Perth', label: 'Perth Time (AWST)', offsetLabel: 'UTC+08:00', region: 'Australia' },
	{ value: 'Pacific/Auckland', label: 'New Zealand Standard Time (NZST)', offsetLabel: 'UTC+12:00', region: 'Pacific' },
	{ value: 'Pacific/Fiji', label: 'Fiji Time', offsetLabel: 'UTC+12:00', region: 'Pacific' },

	// Latin America
	{ value: 'America/Sao_Paulo', label: 'Sao Paulo, Rio de Janeiro', offsetLabel: 'UTC-03:00', region: 'Latin America' },
	{ value: 'America/Buenos_Aires', label: 'Buenos Aires Time', offsetLabel: 'UTC-03:00', region: 'Latin America' },
	{ value: 'America/Santiago', label: 'Santiago Time', offsetLabel: 'UTC-04:00', region: 'Latin America' },
	{ value: 'America/Bogota', label: 'Bogota, Lima, Quito', offsetLabel: 'UTC-05:00', region: 'Latin America' },
	{ value: 'America/Mexico_City', label: 'Mexico City Time', offsetLabel: 'UTC-06:00', region: 'Latin America' },

	// Africa
	{ value: 'Africa/Cairo', label: 'Cairo, Alexandria', offsetLabel: 'UTC+02:00', region: 'Africa' },
	{ value: 'Africa/Johannesburg', label: 'South African Standard Time (SAST)', offsetLabel: 'UTC+02:00', region: 'Africa' },
	{ value: 'Africa/Lagos', label: 'West Africa Time (Nigeria)', offsetLabel: 'UTC+01:00', region: 'Africa' },
	{ value: 'Africa/Nairobi', label: 'East Africa Time (Kenya)', offsetLabel: 'UTC+03:00', region: 'Africa' },
	{ value: 'Africa/Casablanca', label: 'Morocco Time', offsetLabel: 'UTC+01:00', region: 'Africa' },

	// Standard UTC
	{ value: 'UTC', label: 'Coordinated Universal Time (UTC)', offsetLabel: 'UTC+00:00', region: 'UTC' }
];

export const TIMEZONE_LABELS: Record<string, string> = Object.fromEntries(
	TIMEZONE_OPTIONS.map((t) => [t.value, t.label])
);

export const TIMEZONE_GROUPS: Record<string, Array<{ value: string; label: string }>> = TIMEZONE_OPTIONS.reduce(
	(acc, tz) => {
		if (!acc[tz.region]) acc[tz.region] = [];
		acc[tz.region].push({ value: tz.value, label: `${tz.label} (${tz.offsetLabel})` });
		return acc;
	},
	{} as Record<string, Array<{ value: string; label: string }>>
);

export function getTimezoneLabel(tz: string): string {
	const found = TIMEZONE_OPTIONS.find((t) => t.value === tz);
	if (found) return `${found.label} (${found.offsetLabel})`;
	return tz.replace(/_/g, ' ').split('/').pop() || tz;
}

export function detectTimezone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
	} catch {
		return 'Asia/Kolkata';
	}
}

export function getCurrentTime(tz: string, use12Hour = true): string {
	try {
		return new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: use12Hour,
			timeZone: tz
		}).format(new Date());
	} catch {
		return '--:--';
	}
}

export function getTimezoneWithTime(tz: string, use12Hour = true): string {
	return `${getTimezoneLabel(tz)} • ${getCurrentTime(tz, use12Hour)}`;
}
