<script lang="ts">
	import { browser } from '$app/environment';
	import type { PageData } from './$types';
	import TimezoneSelector from '$lib/components/TimezoneSelector.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { createBrandColors } from '$lib/utils/colorUtils';
	import { detectTimezone, getTimezoneWithTime } from '$lib/constants/timezones';
	import { formatDateLocal, formatSelectedDate } from '$lib/utils/dateFormatters';
	import { BookingCalendar, TimeSlotList, BookingForm, BookingSuccess, EventSidebar } from '$lib/components/booking';
	import { clientUser, syncBookingToFirestore } from '$lib/firebase/client';

	let { data }: { data: PageData } = $props();

	// Assigned specialist selection
	let selectedExpertId = $state<string>(data.defaultExpertId || '');
	const selectedExpert = $derived(
		(data.assignedExperts as any[])?.find((e: any) => e.id === selectedExpertId) ||
		(data.assignedExperts as any[])?.[0] ||
		data.host
	);

	// Session duration selection based on expert pricing tiers
	let selectedDuration = $state<number>(30);
	$effect(() => {
		if (selectedExpert?.session_pricing && selectedExpert.session_pricing.length > 0) {
			selectedDuration = selectedExpert.session_pricing[0].duration;
		} else {
			selectedDuration = data.eventType?.duration || 30;
		}
	});

	// Sanitize event description to prevent XSS
	let sanitizedDescription = $state('');
	$effect(() => {
		if (data.eventType?.description) {
			if (browser) {
				import('isomorphic-dompurify').then(({ default: DOMPurify }) => {
					sanitizedDescription = DOMPurify.sanitize(data.eventType!.description!);
				});
			} else {
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
		couponCode: ''
	});

	let bookingStatus = $state<'idle' | 'submitting' | 'success' | 'error'>('idle');
	let bookingError = $state('');
	let meetingUrl = $state<string | null>(null);
	let meetingType = $state<'google_meet' | 'teams'>('google_meet');

	// Track which dates have available slots
	let availableDates = $state<Set<string>>(new Set());
	let loadingAvailability = $state(false);

	// Mobile step tracking: 'calendar' -> 'times' -> 'form'
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

	function formatMonthYear(date: Date) {
		return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
	}

	// Calendar days computation
	const calendarDays = $derived(() => {
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
			const isAvailable = date >= today && date <= new Date(today.getTime() + 60 * 24 * 60 * 1000);
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
		fetchMonthAvailability();
	}

	async function fetchMonthAvailability() {
		loadingAvailability = true;
		try {
			const year = currentMonth.getFullYear();
			const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
			const expertParam = selectedExpertId ? `&expertId=${encodeURIComponent(selectedExpertId)}` : '';
			const response = await fetch(
				`/api/availability/month?event=${data.slug}&month=${year}-${month}${expertParam}`
			);
			if (!response.ok) throw new Error('Failed to fetch month availability');

			const result = (await response.json()) as { availableDates?: string[] };
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
			const response = await fetch(
				`/api/availability?event=${data.slug}&date=${dateStr}${expertParam}&duration=${selectedDuration}`
			);
			if (!response.ok) throw new Error('Failed to fetch availability');
			const result = (await response.json()) as { slots?: Array<{ start: string; end: string }> };
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
					durationMinutes: selectedDuration,
					attendeeName: bookingForm.name,
					attendeeEmail: bookingForm.email,
					attendeePhone: fullPhone,
					notes: bookingForm.notes,
					couponCode: bookingForm.couponCode,
					timezone: selectedTimezone,
					clientFirebaseUid: $clientUser?.uid || null
				})
			});

			if (!response.ok) {
				const errData = (await response.json()) as { message?: string };
				throw new Error(errData.message || 'Failed to schedule booking');
			}

			const result = (await response.json()) as {
				id?: string;
				bookingId?: string;
				meetingUrl?: string;
				meetingType?: 'google_meet' | 'teams';
			};
			meetingUrl = result.meetingUrl || null;
			meetingType = result.meetingType || 'google_meet';
			bookingStatus = 'success';

			// Cross-platform sync to Firebase Firestore for client & expert portal
			const resolvedBookingId = result.bookingId || result.id;
			if ($clientUser?.uid && resolvedBookingId) {
				syncBookingToFirestore({
					bookingId: resolvedBookingId,
					clientUid: $clientUser.uid,
					attendeeName: bookingForm.name.trim(),
					attendeeEmail: bookingForm.email.trim().toLowerCase(),
					attendeePhone: fullPhone,
					eventSlug: data.slug,
					eventName: data.eventType?.name || 'Strategic Technology Consultation',
					expertName: selectedExpert?.name || 'Neubofy Specialist',
					expertId: selectedExpertId,
					startTime: selectedSlot?.start || '',
					endTime: selectedSlot?.end || '',
					durationMinutes: selectedDuration,
					priceAmount: 0,
					couponCode: bookingForm.couponCode,
					meetingUrl: meetingUrl || undefined
				}).catch((e) => console.warn('Firestore sync non-blocking error:', e));
			}
		} catch (error: any) {
			console.error('Booking error:', error);
			bookingError = error.message || 'Failed to create booking';
			bookingStatus = 'error';
		}
	}

	const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
</script>

<svelte:head>
	<title>{data.eventType?.name ? `${data.eventType.name} | Strategic Consultation | Neubofy™` : 'Book Strategy Consultation | Neubofy™'}</title>
	<meta
		name="description"
		content={data.eventType?.description || 'Book an expert technology strategy consultation with Neubofy. Architecture, AI automation, and system integration advisory.'}
	/>
	<meta name="keywords" content="technology consultation, software architecture advisory, AI workflow automation, CTO as a service, Neubofy consultation" />
	<meta name="author" content="Neubofy" />
	<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
	<link rel="canonical" href={`https://booking.neubofy.in/${data.slug}`} />

	<!-- Open Graph -->
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Neubofy™" />
	<meta property="og:title" content={`${data.eventType?.name || 'Strategic Technology Consultation'} | Neubofy™`} />
	<meta property="og:description" content={data.eventType?.description || 'Book a specialized technology strategy consultation with Neubofy.'} />
	<meta property="og:url" content={`https://booking.neubofy.in/${data.slug}`} />
	<meta property="og:image" content={data.eventType?.cover_image || 'https://neubofy.in/neubofylogo.png'} />
	<meta property="og:image:alt" content="Neubofy Logo" />

	<!-- Twitter Cards -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:site" content="@neubofy" />
	<meta name="twitter:creator" content="@neubofy" />
	<meta name="twitter:title" content={`${data.eventType?.name || 'Strategic Technology Consultation'} | Neubofy™`} />
	<meta name="twitter:description" content={data.eventType?.description || 'Book a specialized technology strategy consultation with Neubofy.'} />
	<meta name="twitter:image" content={data.eventType?.cover_image || 'https://neubofy.in/neubofylogo.png'} />

	<!-- Dynamic favicon based on brand color -->
	<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,{encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><linearGradient id='grad' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' style='stop-color:${brandColor};stop-opacity:1'/><stop offset='100%' style='stop-color:${colors.darkHex};stop-opacity:1'/></linearGradient></defs><circle cx='16' cy='16' r='15' fill='url(%23grad)'/><rect x='7' y='9' width='18' height='15' rx='2' fill='white' opacity='0.95'/><rect x='7' y='9' width='18' height='5' rx='2' fill='white'/><rect x='7' y='12' width='18' height='2' fill='${brandColor}'/><rect x='10' y='6' width='2.5' height='5' rx='1' fill='white'/><rect x='19.5' y='6' width='2.5' height='5' rx='1' fill='white'/><circle cx='16' cy='18' r='4' fill='none' stroke='${colors.darkHex}' stroke-width='1.5'/><line x1='16' y1='18' x2='16' y2='16' stroke='${colors.darkHex}' stroke-width='1.5' stroke-linecap='round'/><line x1='16' y1='18' x2='18' y2='18' stroke='${colors.darkHex}' stroke-width='1.5' stroke-linecap='round'/></svg>`)}" />

	<!-- Schema.org JSON-LD Structured Data for SEO & AEO -->
	{@html `<script type="application/ld+json">
	${JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'Service',
				'@id': `https://booking.neubofy.in/${data.slug}#service`,
				'name': data.eventType?.name || 'Strategic Technology Consultation',
				'description': data.eventType?.description || 'Book a specialized technology strategy consultation with Neubofy.',
				'serviceType': 'Technology Strategy & Architecture Advisory',
				'provider': {
					'@type': 'Organization',
					'name': 'Neubofy™',
					'url': 'https://neubofy.in',
					'logo': 'https://neubofy.in/neubofylogo.png'
				},
				'areaServed': 'Global'
			},
			{
				'@type': 'ProfessionalService',
				'@id': `https://booking.neubofy.in/${data.slug}#professionalservice`,
				'name': 'Neubofy Strategic Consultation',
				'url': `https://booking.neubofy.in/${data.slug}`,
				'image': 'https://neubofy.in/neubofylogo.png',
				'provider': {
					'@type': 'Organization',
					'name': 'Neubofy™',
					'url': 'https://neubofy.in'
				},
				'priceRange': 'VIP Waiver Available / Consultation Tiers'
			},
			{
				'@type': 'ScheduleAction',
				'name': `Book ${data.eventType?.name || 'Strategic Consultation'}`,
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
			},
			{
				'@type': 'FAQPage',
				'@id': `https://booking.neubofy.in/${data.slug}#faq`,
				'mainEntity': [
					{
						'@type': 'Question',
						'name': 'What is covered during this strategy consultation?',
						'acceptedAnswer': {
							'@type': 'Answer',
							'text': 'We evaluate your business goals, examine technical roadblocks, determine optimal software architectures, and advise whether custom build, SaaS configuration, or an AI workflow is the fastest, most cost-effective path forward.'
						}
					},
					{
						'@type': 'Question',
						'name': 'Can I apply a VIP discount or referral code?',
						'acceptedAnswer': {
							'@type': 'Answer',
							'text': 'Yes, Neubofy offers VIP waiver coupons (such as NEUBOFYVIP for 100% complimentary access) that reduce your session fee to zero with instant confirmation.'
						}
					},
					{
						'@type': 'Question',
						'name': 'How is meeting attendance coordinated?',
						'acceptedAnswer': {
							'@type': 'Answer',
							'text': 'Upon booking, an automated Google Meet video link is generated and sent to your email. You can also view all upcoming appointments and launch the session directly through your Neubofy Client Portal (/portal).'
						}
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
			eventName={data.eventType?.name || 'Strategic Consultation'}
			{selectedDate}
			{selectedSlot}
			{meetingUrl}
			{meetingType}
			{brandColor}
			{formatTimeRange}
			{formatSelectedDate}
		/>
		<div class="mt-6 flex items-center justify-center gap-4">
			<a
				href="/portal"
				class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition-colors"
			>
				Open Client Portal →
			</a>
			<a
				href="/"
				class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 text-xs transition-colors"
			>
				Book Another Session
			</a>
		</div>
		<Footer class="mt-6" />
	{:else}
		<!-- ========================================================= -->
		<!-- MOBILE LAYOUT (< 768px) -->
		<!-- ========================================================= -->
		<div class="md:hidden min-h-screen w-full bg-[#09090b] text-zinc-100">
			{#if data.eventType?.cover_image}
				<div class="px-6 pt-6 flex justify-center">
					<img src={data.eventType.cover_image} alt="" class="max-h-16 w-auto object-contain" />
				</div>
				<div class="border-b border-white/10 mx-6 mt-4"></div>
			{/if}

			<!-- Back button for non-calendar steps -->
			{#if mobileStep !== 'calendar'}
				<div class="px-6 pt-4">
					<button
						type="button"
						onclick={goBackMobile}
						class="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition py-1"
					>
						<span>←</span>
						<span>{mobileStep === 'form' ? 'Back to times' : 'Back to calendar'}</span>
					</button>
				</div>
			{/if}

			<!-- Mobile Step 1: Calendar & Specialist Selection -->
			{#if mobileStep === 'calendar'}
				<div class="px-6 pt-4 pb-2">
					<span class="text-[10px] font-bold uppercase tracking-wider text-blue-400">Strategic Consultation</span>
					<h1 class="text-xl font-bold text-white mt-1">{data.eventType?.name || 'Technology Advisory'}</h1>
					{#if sanitizedDescription}
						<div class="text-xs text-zinc-400 mt-2 line-clamp-3">
							{@html sanitizedDescription}
						</div>
					{/if}
				</div>

				<!-- Specialist Consultant Selector (Mobile) -->
				{#if data.assignedExperts && data.assignedExperts.length > 1}
					<div class="px-6 mb-4">
						<span class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
							Choose Specialist Consultant *
						</span>
						<div class="space-y-1.5">
							{#each data.assignedExperts as exp}
								{@const isExpSelected = selectedExpertId === exp.id}
								<button
									type="button"
									onclick={() => selectExpert(exp.id)}
									class="w-full p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all {isExpSelected
										? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
										: 'bg-white/5 border-white/10 text-zinc-300'}"
								>
									{#if exp.profile_image}
										<img src={exp.profile_image} alt={exp.name} class="w-8 h-8 rounded-full object-cover shrink-0 border border-white/20" />
									{:else}
										<div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
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

				<!-- Duration Selection Tier if Expert offers multiple tiers -->
				{#if selectedExpert?.session_pricing && selectedExpert.session_pricing.length > 1}
					<div class="px-6 mb-4">
						<span class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
							Session Duration Tier
						</span>
						<div class="grid grid-cols-2 gap-2">
							{#each selectedExpert.session_pricing as tier}
								{@const isSelectedTier = selectedDuration === tier.duration}
								<button
									type="button"
									onclick={() => { selectedDuration = tier.duration; }}
									class="p-2 rounded-xl border text-center transition-all {isSelectedTier
										? 'bg-blue-600 border-blue-500 text-white font-bold'
										: 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'}"
								>
									<div class="text-xs">{tier.duration} Mins</div>
									<div class="text-[10px] font-mono opacity-80">{tier.price === 0 ? 'Complimentary' : `₹${tier.price}`}</div>
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Calendar -->
				<div class="px-6 pb-8">
					<h2 class="text-base font-semibold text-white mb-4 text-center">Select Consultation Date</h2>

					<div class="flex items-center justify-between mb-4">
						<button onclick={prevMonth} class="p-2 hover:bg-white/10 rounded-full transition text-zinc-300" aria-label="Previous month">
							←
						</button>
						<h3 class="text-sm font-semibold text-white">{formatMonthYear(currentMonth)}</h3>
						<button onclick={nextMonth} class="p-2 hover:bg-white/10 rounded-full transition text-zinc-300" aria-label="Next month">
							→
						</button>
					</div>

					<div class="grid grid-cols-7 gap-1 mb-2 text-center text-[10px] font-semibold text-zinc-500">
						{#each weekDays as day}
							<div>{day}</div>
						{/each}
					</div>

					<div class="grid grid-cols-7 gap-1">
						{#each calendarDays() as day}
							{@const hasSlots = availableDates.has(day.dateStr)}
							{@const isClickable = day.isAvailable && hasSlots}
							{@const isSelected = selectedDate === day.dateStr}
							<button
								type="button"
								onclick={() => isClickable && handleDateSelect(day.dateStr)}
								disabled={!isClickable}
								class="aspect-square flex items-center justify-center text-xs rounded-full transition
									{!day.isCurrentMonth ? 'text-zinc-700' : ''}
									{isClickable && !isSelected ? 'font-semibold text-zinc-200 hover:bg-white/10' : ''}
									{day.isAvailable && !hasSlots && day.isCurrentMonth ? 'text-zinc-600' : ''}
									{!day.isAvailable && day.isCurrentMonth ? 'text-zinc-700' : ''}
									{isSelected ? 'text-white font-bold ring-2 ring-blue-500 bg-blue-600' : ''}"
							>
								{day.date.getDate()}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Mobile Step 2: Time Slots -->
			{#if mobileStep === 'times'}
				<div class="px-6 pb-8">
					<h2 class="text-lg font-semibold text-white mb-1 text-center">Select a Time</h2>
					<p class="text-xs text-zinc-400 text-center mb-6">{selectedDate ? formatSelectedDate(selectedDate) : ''}</p>
					{#if loading}
						<div class="flex items-center justify-center py-8">
							<div class="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent border-blue-500"></div>
						</div>
					{:else if availableSlots.length === 0}
						<p class="text-xs text-zinc-400 py-4 text-center">No available times for this date</p>
					{:else}
						<div class="grid grid-cols-2 gap-2.5">
							{#each availableSlots as slot}
								{@const isSelected = selectedSlot === slot}
								<button
									type="button"
									onclick={() => selectSlot(slot)}
									class="py-3 px-3 border rounded-xl text-xs font-semibold transition
										{isSelected ? 'border-blue-500 bg-blue-600/20 text-blue-400' : 'border-white/10 bg-white/5 text-zinc-300'}"
								>
									{formatTime(slot.start)}
								</button>
							{/each}
						</div>
						{#if selectedSlot}
							<button
								type="button"
								onclick={confirmSlot}
								class="w-full mt-6 py-3 px-6 text-white rounded-xl font-semibold bg-blue-600 hover:bg-blue-500 transition shadow-lg"
							>
								Continue to Details →
							</button>
						{/if}
					{/if}
				</div>
			{/if}

			<!-- Mobile Step 3: Booking Form with Firebase Auth & Coupon Waiver -->
			{#if mobileStep === 'form'}
				<div class="px-6 pb-8">
					<BookingForm
						bind:bookingForm
						eventSlug={data.slug}
						expertUserId={selectedExpertId}
						durationMinutes={selectedDuration}
						sessionPricing={selectedExpert?.session_pricing || []}
						basePriceInr={data.eventType?.price_inr || 0}
						{bookingStatus}
						{bookingError}
						{brandColor}
						brandDark={colors.dark}
						onSubmit={handleSubmit}
					/>
				</div>
			{/if}

			<Footer class="px-6 pb-8" />
		</div>

		<!-- ========================================================= -->
		<!-- DESKTOP LAYOUT (>= 768px) -->
		<!-- ========================================================= -->
		<div
			class="hidden md:flex glass-card rounded-3xl border border-white/10 shadow-2xl overflow-hidden transition-all duration-300 ease-in-out"
			style="width: {showForm ? '720px' : selectedDate ? '940px' : '680px'}"
		>
			<!-- Left Sidebar -->
			<EventSidebar
				user={{
					...data.user,
					name: selectedExpert?.name || data.host?.name || data.user?.name,
					profileImage: selectedExpert?.profile_image || data.user?.profileImage
				}}
				eventType={{
					...data.eventType,
					duration: selectedDuration
				}}
				{selectedDate}
				{selectedSlot}
				{brandColor}
				{formatTime}
			/>

			<!-- Main Content Area -->
			<div class="flex-1 p-6">
				{#if bookingError}
					<div class="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 mb-6 max-w-2xl text-xs">
						{bookingError}
					</div>
				{/if}

				{#if showForm}
					<div class="animate-fade-in">
						<button
							type="button"
							onclick={() => (showForm = false)}
							class="text-xs text-zinc-400 hover:text-white mb-4 flex items-center gap-1.5 transition-colors"
						>
							← Back to Time Slot Selection
						</button>
						<BookingForm
							bind:bookingForm
							eventSlug={data.slug}
							expertUserId={selectedExpertId}
							durationMinutes={selectedDuration}
							sessionPricing={selectedExpert?.session_pricing || []}
							basePriceInr={data.eventType?.price_inr || 0}
							{bookingStatus}
							{bookingError}
							{brandColor}
							brandDark={colors.dark}
							onSubmit={handleSubmit}
						/>
					</div>
				{:else}
					<div class="flex items-stretch gap-6">
						<div class="w-80">
							<h2 class="text-lg font-bold text-white mb-3">Select Date & Specialist</h2>

							<!-- Specialist Consultant Selector (Desktop) -->
							{#if data.assignedExperts && data.assignedExperts.length > 1}
								<div class="mb-4 p-2.5 rounded-2xl bg-white/[0.03] border border-white/10">
									<span class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
										Specialist Consultant *
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

							<!-- Duration Tier Selector if multiple tiers exist -->
							{#if selectedExpert?.session_pricing && selectedExpert.session_pricing.length > 1}
								<div class="mb-4">
									<span class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
										Session Duration & Rate
									</span>
									<div class="grid grid-cols-2 gap-1.5">
										{#each selectedExpert.session_pricing as tier}
											{@const isSelectedTier = selectedDuration === tier.duration}
											<button
												type="button"
												onclick={() => { selectedDuration = tier.duration; }}
												class="p-2 rounded-xl border text-left transition-all {isSelectedTier
													? 'bg-blue-600/25 border-blue-500 text-white'
													: 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'}"
											>
												<div class="text-xs font-bold">{tier.duration} Mins</div>
												<div class="text-[10px] font-mono text-zinc-400">
													{tier.price === 0 ? 'Complimentary' : `₹${tier.price}`}
												</div>
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

							<div class="mt-4 relative">
								<p class="text-xs font-semibold text-zinc-400 mb-1">Timezone</p>
								<button
									type="button"
									onclick={() => (showTimezoneDropdown = !showTimezoneDropdown)}
									class="flex items-center gap-2 text-xs text-zinc-300 hover:text-white transition"
								>
									<span>🌐 {getTimezoneWithTime(selectedTimezone, use12Hour)}</span>
									<span class="text-[10px] text-zinc-500">▾</span>
								</button>
								{#if showTimezoneDropdown}
									<TimezoneSelector
										{selectedTimezone}
										onSelect={(tz) => (selectedTimezone = tz)}
										onClose={() => (showTimezoneDropdown = false)}
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
