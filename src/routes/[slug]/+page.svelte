<script lang="ts">
	import { browser } from '$app/environment';
	import type { PageData } from './$types';
	import TimezoneSelector from '$lib/components/TimezoneSelector.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { createBrandColors } from '$lib/utils/colorUtils';
	import { detectTimezone, getTimezoneLabel, getTimezoneWithTime, TIMEZONE_LABELS } from '$lib/constants/timezones';
	import { formatDateLocal, formatSelectedDate, createFormatters } from '$lib/utils/dateFormatters';
	import { BookingCalendar, TimeSlotList, BookingForm, BookingSuccess, EventSidebar } from '$lib/components/booking';

	let { data }: { data: PageData } = $props();

	// Assigned specialist selection
	let selectedExpertId = $state<string>(data.defaultExpertId || '');
	const selectedExpert = $derived(
		(data.assignedExperts as any[])?.find((e: any) => e.id === selectedExpertId) ||
		(data.assignedExperts as any[])?.[0] ||
		data.host
	);

	// Sanitize event description to prevent XSS (only in browser, SSR uses escaped version)
	let sanitizedDescription = $state('');
	$effect(() => {
		if (data.eventType?.description) {
			if (browser) {
				import('isomorphic-dompurify').then(({ default: DOMPurify }) => {
					sanitizedDescription = DOMPurify.sanitize(data.eventType!.description!);
				});
			} else {
				// During SSR, escape basic HTML entities as a fallback
				sanitizedDescription = data.eventType.description
					.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;');
			}
		} else {
			sanitizedDescription = '';
		}
	});

	// Brand colors
	const brandColor = data.user?.brandColor || '#3b82f6';
	const colors = createBrandColors(brandColor);

	let selectedDate = $state<string | null>(null);
	let selectedSlot = $state<{ start: string; end: string } | null>(null);
	let availableSlots = $state<Array<{ start: string; end: string }>>([]);
	let loading = $state(false);
	let showForm = $state(false);
	let bookingForm = $state({
		name: '',
		email: '',
		phone: '',
		countryCode: '+91',
		notes: '',
		couponCode: '',
		verificationToken: ''
	});

	let bookingStatus = $state<'idle' | 'submitting' | 'success' | 'error'>('idle');
	let bookingError = $state('');
	let meetingUrl = $state<string | null>(null);
	let meetingType = $state<'google_meet' | 'teams'>('google_meet');

	// Track which dates have available slots
	let availableDates = $state<Set<string>>(new Set());
	let loadingAvailability = $state(false);

	// Mobile step tracking
	let mobileStep = $state<'calendar' | 'times' | 'form'>('calendar');

	// Timezone state
	let selectedTimezone = $state(detectTimezone());
	let showTimezoneDropdown = $state(false);

	// Calendar state
	let currentMonth = $state(new Date());

	// Date/time formatters
	const use12Hour = data.user?.timeFormat !== '24h';

	function formatTime(isoStr: string) {
		const date = new Date(isoStr);
		return new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: use12Hour,
			timeZone: selectedTimezone
		}).format(date);
	}

	function formatTimeRange(start: string, end: string) {
		return `${formatTime(start)} - ${formatTime(end)}`;
	}

	function formatShortDate(dateStr: string) {
		const date = new Date(dateStr + 'T12:00:00');
		return new Intl.DateTimeFormat('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		}).format(date);
	}

	function formatMonthYear(date: Date) {
		return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
	}

	// Calendar days computation
	const calendarDays = $derived.by(() => {
		const year = currentMonth.getFullYear();
		const month = currentMonth.getMonth();
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const startPadding = (firstDay.getDay() + 6) % 7;
		const days: Array<{ date: Date; isCurrentMonth: boolean; isAvailable: boolean; dateStr: string }> = [];

		for (let i = 0; i < startPadding; i++) {
			const date = new Date(year, month, i - startPadding + 1);
			days.push({
				date,
				isCurrentMonth: false,
				isAvailable: false,
				dateStr: formatDateLocal(date)
			});
		}

		const today = new Date();
		today.setHours(0, 0, 0, 0);
		for (let i = 1; i <= lastDay.getDate(); i++) {
			const date = new Date(year, month, i);
			const dateStr = formatDateLocal(date);
			const isAvailable = date >= today && date <= new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
			days.push({
				date,
				isCurrentMonth: true,
				isAvailable,
				dateStr
			});
		}

		const remaining = 42 - days.length;
		for (let i = 1; i <= remaining; i++) {
			const date = new Date(year, month + 1, i);
			days.push({
				date,
				isCurrentMonth: false,
				isAvailable: false,
				dateStr: formatDateLocal(date)
			});
		}

		return days;
	});

	function prevMonth() {
		currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
		fetchMonthAvailability();
	}

	function nextMonth() {
		currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
		fetchMonthAvailability();
	}

	function selectExpert(expertId: string) {
		if (selectedExpertId === expertId) return;
		selectedExpertId = expertId;
		selectedDate = null;
		selectedSlot = null;
		availableSlots = [];
		if (browser) {
			const url = new URL(window.location.href);
			url.searchParams.set('expert', expertId);
			window.history.replaceState({}, '', url.toString());
		}
		fetchMonthAvailability();
	}

	async function fetchMonthAvailability() {
		loadingAvailability = true;

		try {
			const year = currentMonth.getFullYear();
			const month = currentMonth.getMonth() + 1;
			const monthStr = `${year}-${String(month).padStart(2, '0')}`;
			const expertParam = selectedExpertId ? `&expertId=${encodeURIComponent(selectedExpertId)}` : '';

			const response = await fetch(`/api/availability/month?event=${data.slug}&month=${monthStr}${expertParam}`);
			if (!response.ok) throw new Error('Failed to fetch availability');

			const result = await response.json() as { availableDates?: string[] };
			availableDates = new Set(result.availableDates || []);
		} catch (error) {
			console.error('Error fetching month availability:', error);
			availableDates = new Set();
		} finally {
			loadingAvailability = false;
		}
	}

	$effect(() => {
		fetchMonthAvailability();
	});

	async function handleDateSelect(dateStr: string) {
		selectedDate = dateStr;
		selectedSlot = null;
		showForm = false;
		loading = true;
		mobileStep = 'times';

		try {
			const expertParam = selectedExpertId ? `&expertId=${encodeURIComponent(selectedExpertId)}` : '';
			const response = await fetch(`/api/availability?event=${data.slug}&date=${dateStr}${expertParam}`);
			if (!response.ok) throw new Error('Failed to fetch availability');
			const result = await response.json() as { slots?: Array<{ start: string; end: string }> };
			availableSlots = result.slots || [];
		} catch (error) {
			console.error('Error fetching availability:', error);
			availableSlots = [];
		} finally {
			loading = false;
		}
	}

	function selectSlot(slot: { start: string; end: string }) {
		selectedSlot = slot;
	}

	function confirmSlot() {
		showForm = true;
		mobileStep = 'form';
	}

	function goBackMobile() {
		if (mobileStep === 'form') {
			mobileStep = 'times';
			showForm = false;
		} else if (mobileStep === 'times') {
			mobileStep = 'calendar';
			selectedDate = null;
			selectedSlot = null;
			availableSlots = [];
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		bookingStatus = 'submitting';
		bookingError = '';

		if (!bookingForm.verificationToken) {
			bookingError = 'Please verify your email address with the 6-digit OTP code before scheduling.';
			bookingStatus = 'error';
			return;
		}

		const fullPhone = bookingForm.phone?.trim()
			? `${bookingForm.countryCode || '+91'} ${bookingForm.phone.trim()}`
			: '';

		try {
			const response = await fetch('/api/bookings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					eventSlug: data.slug,
					expertUserId: selectedExpertId,
					startTime: selectedSlot?.start,
					endTime: selectedSlot?.end,
					attendeeName: bookingForm.name,
					attendeeEmail: bookingForm.email,
					attendeePhone: fullPhone,
					notes: bookingForm.notes,
					couponCode: bookingForm.couponCode,
					timezone: selectedTimezone,
					verificationToken: bookingForm.verificationToken
				})
			});

			if (!response.ok) {
				const errData = (await response.json()) as { message?: string };
				throw new Error(errData.message || 'Failed to create booking');
			}

			const result = (await response.json()) as {
				meetingUrl?: string;
				meetingType?: 'google_meet' | 'teams';
				requiresPayment?: boolean;
				paymentUrl?: string;
			};

			if (result.requiresPayment && result.paymentUrl) {
				window.location.href = result.paymentUrl;
				return;
			}

			meetingUrl = result.meetingUrl || null;
			meetingType = result.meetingType || 'google_meet';
			bookingStatus = 'success';
		} catch (error: any) {
			console.error('Booking error:', error);
			bookingError = error.message || 'Failed to create booking';
			bookingStatus = 'error';
		}
	}

	const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
</script>

<svelte:head>
	<title>{data.eventType?.name ? `${data.eventType.name} | Neubofy Consultation` : 'Book a Strategy Consultation | Neubofy™'}</title>
	<meta
		name="description"
		content={data.eventType?.description || 'Book a specialized technology strategy consultation with Neubofy. Architecture, AI automation, and system integration advisory.'}
	/>
	<meta name="author" content="Neubofy" />
	<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
	<link rel="canonical" href={`https://booking.neubofy.in/${data.slug}`} />

	<!-- Open Graph -->
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Neubofy™" />
	<meta property="og:title" content={`${data.eventType?.name || 'Technology Consultation'} | Neubofy™`} />
	<meta property="og:description" content={data.eventType?.description || 'Book a specialized technology strategy consultation with Neubofy.'} />
	<meta property="og:url" content={`https://booking.neubofy.in/${data.slug}`} />
	<meta property="og:image" content={data.eventType?.cover_image || 'https://neubofy.in/neubofylogo.png'} />
	<meta property="og:image:alt" content="Neubofy Logo" />

	<!-- Twitter Cards -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:site" content="@neubofy" />
	<meta name="twitter:creator" content="@neubofy" />
	<meta name="twitter:title" content={`${data.eventType?.name || 'Technology Consultation'} | Neubofy™`} />
	<meta name="twitter:description" content={data.eventType?.description || 'Book a specialized technology strategy consultation with Neubofy.'} />
	<meta name="twitter:image" content={data.eventType?.cover_image || 'https://neubofy.in/neubofylogo.png'} />

	<!-- Dynamic favicon based on brand color -->
	<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,{encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><linearGradient id='grad' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' style='stop-color:${brandColor};stop-opacity:1'/><stop offset='100%' style='stop-color:${colors.darkHex};stop-opacity:1'/></linearGradient></defs><circle cx='16' cy='16' r='15' fill='url(%23grad)'/><rect x='7' y='9' width='18' height='15' rx='2' fill='white' opacity='0.95'/><rect x='7' y='9' width='18' height='5' rx='2' fill='white'/><rect x='7' y='12' width='18' height='2' fill='${brandColor}'/><rect x='10' y='6' width='2.5' height='5' rx='1' fill='white'/><rect x='19.5' y='6' width='2.5' height='5' rx='1' fill='white'/><circle cx='16' cy='18' r='4' fill='none' stroke='${colors.darkHex}' stroke-width='1.5'/><line x1='16' y1='18' x2='16' y2='16' stroke='${colors.darkHex}' stroke-width='1.5' stroke-linecap='round'/><line x1='16' y1='18' x2='18' y2='18' stroke='${colors.darkHex}' stroke-width='1.5' stroke-linecap='round'/></svg>`)}" />

	<!-- Schema.org JSON-LD -->
	{@html `<script type="application/ld+json">
	${JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'Service',
				'@id': `https://booking.neubofy.in/${data.slug}#service`,
				'name': data.eventType?.name || 'Technology Consultation',
				'description': data.eventType?.description || 'Book a specialized technology strategy consultation with Neubofy.',
				'serviceType': 'Technology Strategy Advisory',
				'provider': {
					'@type': 'Organization',
					'name': 'Neubofy™',
					'url': 'https://neubofy.in',
					'logo': 'https://neubofy.in/neubofylogo.png'
				},
				'areaServed': 'Global'
			},
			{
				'@type': 'ScheduleAction',
				'name': `Book ${data.eventType?.name || 'Consultation'}`,
				'target': `https://booking.neubofy.in/${data.slug}`,
				'agent': {
					'@type': 'Organization',
					'name': 'Neubofy™'
				}
			},
			{
				'@type': 'BreadcrumbList',
				'itemListElement': [
					{
						'@type': 'ListItem',
						'position': 1,
						'name': 'Home',
						'item': 'https://booking.neubofy.in/'
					},
					{
						'@type': 'ListItem',
						'position': 2,
						'name': data.eventType?.name || 'Consultation',
						'item': `https://booking.neubofy.in/${data.slug}`
					}
				]
			}
		]
	})}</script>`}
</svelte:head>

<div
	class="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col items-center md:justify-center p-4 relative overflow-hidden"
	style="--brand-color: {brandColor}; --brand-light: {colors.light}; --brand-lighter: {colors.lighter}; --brand-dark: {colors.dark}; --brand-rgb: {colors.rgb.r}, {colors.rgb.g}, {colors.rgb.b};"
>
	{#if bookingStatus === 'success' && selectedDate && selectedSlot}
		<!-- Success Screen -->
		<BookingSuccess
			eventName={data.eventType?.name || 'Meeting'}
			{selectedDate}
			{selectedSlot}
			{meetingUrl}
			{meetingType}
			{brandColor}
			{formatTimeRange}
			{formatSelectedDate}
		/>
		<Footer class="mt-6" />
	{:else}
		<!-- MOBILE LAYOUT (< 768px) - Obsidian Dark Layout -->
		<div class="md:hidden min-h-screen w-full bg-[#09090b] text-zinc-100">
			<!-- Cover Image with border below -->
			{#if data.eventType?.cover_image}
				<div class="px-6 pt-6 flex justify-center">
					<img src={data.eventType.cover_image} alt="" class="max-h-16 w-auto object-contain" />
				</div>
				<div class="border-b border-white/10 mx-6 mt-4"></div>
			{/if}

			<!-- Back button for non-calendar steps -->
			{#if mobileStep !== 'calendar'}
				<div class="px-6 py-4">
					<button onclick={goBackMobile} class="flex items-center gap-2 text-zinc-400 hover:text-white" aria-label="Go back">
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
						</svg>
						<span class="text-xs font-semibold">Back</span>
					</button>
				</div>
			{/if}

			<!-- Profile Image centered with name below -->
			{#if mobileStep === 'calendar'}
				<div class="flex flex-col items-center pt-8 pb-6 px-6">
					{#if data.user?.profileImage}
						<img src={data.user.profileImage} alt={data.user.name} class="w-20 h-20 rounded-full object-cover border-2 border-white/20 shadow-lg" />
					{:else}
						<div class="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl border-2 border-white/20 shadow-lg" style="background-color: var(--brand-color)">
							{data.user?.name?.charAt(0) || 'M'}
						</div>
					{/if}
					<p class="mt-3 text-xs font-semibold uppercase tracking-wider text-blue-400">{data.user?.name || 'Neubofy Specialist'}</p>
				</div>

				<!-- Meeting Title -->
				<div class="px-6 pb-4">
					<h1 class="text-xl sm:text-2xl font-bold text-white text-center tracking-tight">{data.eventType?.name || 'Consultation'}</h1>
				</div>

				<!-- Meeting Details List -->
				<div class="px-6 pb-5">
					<ul class="space-y-2.5 text-xs text-zinc-300">
						<li class="flex items-center gap-2.5">
							<svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
							</svg>
							<span>{data.eventType?.duration} Minutes</span>
						</li>
						<li class="flex items-center gap-2.5">
							<svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
							</svg>
							<span>{data.eventType?.invite_calendar === 'outlook' ? 'Microsoft Teams' : 'Google Meet'}</span>
						</li>
						<li class="flex items-center gap-2.5">
							<svg class="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
							</svg>
							<button
								type="button"
								onclick={() => showTimezoneDropdown = !showTimezoneDropdown}
								class="flex items-center gap-1 text-zinc-300 hover:text-white transition"
							>
								<span>{getTimezoneWithTime(selectedTimezone, use12Hour)}</span>
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
								</svg>
							</button>
						</li>
					</ul>
					{#if showTimezoneDropdown}
						<div class="mt-2">
							<TimezoneSelector
								{selectedTimezone}
								onSelect={(tz) => selectedTimezone = tz}
								onClose={() => showTimezoneDropdown = false}
								{brandColor}
							/>
						</div>
					{/if}
				</div>

				<!-- Description -->
				{#if data.eventType?.description}
					<div class="px-6 pb-5 text-sm text-zinc-300 prose prose-invert prose-sm max-w-none">
						{@html sanitizedDescription}
					</div>
				{/if}

				<!-- Specialist Consultant Selector (Mobile) -->
				{#if data.assignedExperts && data.assignedExperts.length > 1}
					<div class="px-6 pb-6">
						<span class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2.5">
							Select Consultation Specialist *
						</span>
						<div class="grid grid-cols-1 gap-2">
							{#each data.assignedExperts as exp}
								{@const isExpSelected = selectedExpertId === exp.id}
								<button
									type="button"
									onclick={() => selectExpert(exp.id)}
									class="p-3 rounded-xl border text-left flex items-center gap-3 transition-all {isExpSelected
										? 'bg-blue-600/20 border-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.25)]'
										: 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'}"
								>
									{#if exp.profile_image}
										<img src={exp.profile_image} alt={exp.name} class="w-9 h-9 rounded-full object-cover shrink-0 border border-white/20" />
									{:else}
										<div class="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
											{exp.name.charAt(0)}
										</div>
									{/if}
									<div class="min-w-0 flex-1">
										<div class="text-xs font-bold truncate">{exp.name}</div>
										<div class="text-[10px] text-zinc-400 truncate">{exp.role_title || 'Consultant Specialist'}</div>
									</div>
									{#if isExpSelected}
										<span class="text-blue-400 text-xs shrink-0 font-bold">✓</span>
									{/if}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Calendar with arrows around month name -->
				<div class="px-6 pb-8">
					<h2 class="text-lg font-semibold text-white mb-5 text-center">Select a Date & Time</h2>

					<!-- Month navigation with arrows on sides -->
					<div class="flex items-center justify-between mb-4">
						<button onclick={prevMonth} class="p-2 hover:bg-white/10 rounded-full transition text-zinc-300 hover:text-white" aria-label="Previous month">
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
							</svg>
						</button>
						<h3 class="text-base font-semibold text-white">{formatMonthYear(currentMonth)}</h3>
						<button onclick={nextMonth} class="p-2 hover:bg-white/10 rounded-full transition text-zinc-300 hover:text-white" aria-label="Next month">
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
							</svg>
						</button>
					</div>

					<!-- Weekday headers -->
					<div class="grid grid-cols-7 gap-1 mb-2">
						{#each weekDays as day}
							<div class="text-center text-xs font-medium text-zinc-400 py-2">{day}</div>
						{/each}
					</div>

					<!-- Calendar grid -->
					<div class="grid grid-cols-7 gap-1">
						{#each calendarDays as day}
							{@const hasSlots = availableDates.has(day.dateStr)}
							{@const isClickable = day.isAvailable && hasSlots}
							{@const isSelected = selectedDate === day.dateStr}
							<button
								type="button"
								onclick={() => isClickable && handleDateSelect(day.dateStr)}
								disabled={!isClickable}
								class="aspect-square flex items-center justify-center text-sm rounded-full transition
									{!day.isCurrentMonth ? 'text-zinc-700' : ''}
									{isClickable && !isSelected ? 'font-semibold text-zinc-200 hover:bg-white/10' : ''}
									{day.isAvailable && !hasSlots && day.isCurrentMonth ? 'text-zinc-600' : ''}
									{!day.isAvailable && day.isCurrentMonth ? 'text-zinc-700' : ''}
									{isSelected ? 'text-white font-bold ring-2 ring-blue-500' : ''}"
								style="{isClickable && !isSelected ? `background-color: rgba(59, 130, 246, 0.15); color: #60a5fa;` : ''}{isSelected ? `background-color: var(--brand-color, #2563eb)` : ''}"
							>
								{day.date.getDate()}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Mobile Time Slots -->
			{#if mobileStep === 'times'}
				<div class="px-6 pb-8">
					<h2 class="text-lg font-semibold text-white mb-2 text-center">Select a Time</h2>
					<p class="text-sm text-zinc-400 text-center mb-6">{selectedDate ? formatSelectedDate(selectedDate) : ''}</p>
					{#if loading}
						<div class="flex items-center justify-center py-8">
							<div class="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent border-blue-500"></div>
						</div>
					{:else if availableSlots.length === 0}
						<p class="text-sm text-zinc-400 py-4 text-center">No available times for this date</p>
					{:else}
						<div class="grid grid-cols-2 gap-3">
							{#each availableSlots as slot}
								{@const isSelected = selectedSlot === slot}
								<button
									type="button"
									onclick={() => selectSlot(slot)}
									class="py-3 px-4 border rounded-xl text-sm font-semibold transition min-h-[44px] flex items-center justify-center
										{isSelected ? 'border-blue-500 bg-blue-600/20 text-blue-400 shadow-sm' : 'border-white/10 bg-white/5 text-zinc-300 hover:border-white/20'}"
								>
									{formatTime(slot.start)}
								</button>
							{/each}
						</div>
						{#if selectedSlot}
							<button
								type="button"
								onclick={confirmSlot}
								class="w-full mt-6 py-3.5 px-6 text-white rounded-xl font-semibold transition shadow-lg shadow-blue-500/20 hover:opacity-95 min-h-[48px] flex items-center justify-center"
								style="background-color: var(--brand-color, #2563eb)"
							>
								Next
							</button>
						{/if}
					{/if}
				</div>
			{/if}

			<!-- Mobile Booking Form -->
			{#if mobileStep === 'form'}
				<div class="px-6 pb-8">
					<p class="text-sm text-zinc-400 mb-6 text-center">
						{selectedDate ? formatShortDate(selectedDate) : ''}{selectedSlot ? ` at ${formatTime(selectedSlot.start)}` : ''}
					</p>
					<BookingForm
						bind:bookingForm
						eventSlug={data.slug}
						isFreeOnly={data.eventType?.is_free_only}
						basePriceInr={data.eventType?.price_inr || 0}
						{bookingStatus}
						{bookingError}
						{brandColor}
						brandDark={colors.dark}
						onSubmit={handleSubmit}
					/>
				</div>
			{/if}

			<!-- Mobile Footer -->
			<Footer class="px-6 pb-8" />
		</div>

		<!-- DESKTOP LAYOUT (>= 768px) -->
		<div class="hidden md:flex glass-card rounded-3xl border border-white/10 shadow-2xl overflow-hidden transition-all duration-300 ease-in-out" style="width: {showForm ? '700px' : selectedDate ? '920px' : '650px'}">
			<!-- Left Sidebar -->
			<EventSidebar
				user={{ ...data.user, name: selectedExpert?.name || data.host?.name || data.user?.name, profileImage: selectedExpert?.profile_image || data.user?.profileImage }}
				eventType={data.eventType}
				{selectedDate}
				{selectedSlot}
				{brandColor}
				{formatTime}
			/>

			<!-- Main Content -->
			<div class="flex-1 p-6">
				{#if bookingError}
					<div class="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 mb-6 max-w-2xl">
						{bookingError}
					</div>
				{/if}

				{#if showForm}
					<BookingForm
						bind:bookingForm
						eventSlug={data.slug}
						isFreeOnly={data.eventType?.is_free_only}
						basePriceInr={data.eventType?.price_inr || 0}
						{bookingStatus}
						{bookingError}
						{brandColor}
						brandDark={colors.dark}
						onSubmit={handleSubmit}
					/>
				{:else}
					<div class="flex items-stretch">
						<div class="w-80">
							<h2 class="text-xl font-semibold text-white mb-4">Select a Date & Time</h2>

							<!-- Specialist Consultant Selector (Desktop) -->
							{#if data.assignedExperts && data.assignedExperts.length > 1}
								<div class="mb-4 p-2.5 rounded-2xl bg-white/[0.03] border border-white/10">
									<span class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
										Select Specialist Expert *
									</span>
									<div class="space-y-1.5 max-h-36 overflow-y-auto scrollbar-thin pr-1">
										{#each data.assignedExperts as exp}
											{@const isExpSelected = selectedExpertId === exp.id}
											<button
												type="button"
												onclick={() => selectExpert(exp.id)}
												class="w-full p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all {isExpSelected
													? 'bg-blue-600/20 border-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.25)]'
													: 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'}"
											>
												{#if exp.profile_image}
													<img src={exp.profile_image} alt={exp.name} class="w-7 h-7 rounded-full object-cover shrink-0 border border-white/20" />
												{:else}
													<div class="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
														{exp.name.charAt(0)}
													</div>
												{/if}
												<div class="min-w-0 flex-1">
													<div class="text-xs font-bold truncate leading-tight">{exp.name}</div>
													<div class="text-[9px] text-zinc-400 truncate">{exp.role_title || 'Consultant Specialist'}</div>
												</div>
												{#if isExpSelected}
													<span class="text-blue-400 text-xs shrink-0 font-bold">✓</span>
												{/if}
											</button>
										{/each}
									</div>
								</div>
							{/if}

							<BookingCalendar
								{currentMonth}
								{selectedDate}
								{availableDates}
								{brandColor}
								brandLighter={colors.lighter}
								brandDark={colors.dark}
								onDateSelect={handleDateSelect}
								onPrevMonth={prevMonth}
								onNextMonth={nextMonth}
							/>

							<div class="mt-6 relative">
								<p class="text-sm font-semibold text-zinc-300 mb-2">Time zone</p>
								<button
									type="button"
									onclick={() => showTimezoneDropdown = !showTimezoneDropdown}
									class="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition"
								>
									<svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
									</svg>
									<span>{getTimezoneWithTime(selectedTimezone, use12Hour)}</span>
									<svg class="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
									</svg>
								</button>
								{#if showTimezoneDropdown}
									<TimezoneSelector
										{selectedTimezone}
										onSelect={(tz) => selectedTimezone = tz}
										onClose={() => showTimezoneDropdown = false}
										{brandColor}
									/>
								{/if}
							</div>
						</div>

						{#if selectedDate}
							<TimeSlotList
								{selectedDate}
								{availableSlots}
								{selectedSlot}
								{loading}
								{brandColor}
								{formatTime}
								onSelectSlot={selectSlot}
								onConfirm={confirmSlot}
							/>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<Footer class="mt-6" />
	{/if}
</div>
