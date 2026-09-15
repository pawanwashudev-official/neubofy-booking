<script lang="ts">
	import type { PageData } from './$types';
	import TimezoneSelector from '$lib/components/TimezoneSelector.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { createBrandColors } from '$lib/utils/colorUtils';
	import { detectTimezone, getCurrentTime } from '$lib/constants/timezones';
	import { formatDateLocal, formatSelectedDate } from '$lib/utils/dateFormatters';
	import { BookingCalendar } from '$lib/components/booking';

	let { data }: { data: PageData } = $props();

	// Brand colors
	const brandColor = data.booking.brandColor;
	const colors = createBrandColors(brandColor);

	let selectedDate = $state<string | null>(null);
	let selectedSlot = $state<{ start: string; end: string } | null>(null);
	let availableSlots = $state<Array<{ start: string; end: string }>>([]);
	let loading = $state(false);
	let rescheduleStatus = $state<'idle' | 'submitting' | 'success' | 'error'>('idle');
	let rescheduleError = $state('');
	let newMeetingUrl = $state<string | null>(null);

	// Track which dates have available slots
	let availableDates = $state<Set<string>>(new Set());
	let loadingAvailability = $state(false);

	// Timezone state
	let selectedTimezone = $state(detectTimezone());
	let showTimezoneDropdown = $state(false);

	// Calendar state
	let currentMonth = $state(new Date());

	// Date/time formatters
	const use12Hour = data.timeFormat !== '24h';

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

	function formatOriginalDateTime(dateStr: string) {
		const date = new Date(dateStr);
		return new Intl.DateTimeFormat('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: use12Hour,
			timeZone: selectedTimezone
		}).format(date);
	}

	function prevMonth() {
		currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
		fetchMonthAvailability();
	}

	function nextMonth() {
		currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
		fetchMonthAvailability();
	}

	async function fetchMonthAvailability() {
		loadingAvailability = true;

		try {
			const year = currentMonth.getFullYear();
			const month = currentMonth.getMonth() + 1;
			const monthStr = `${year}-${String(month).padStart(2, '0')}`;

			const response = await fetch(`/api/availability/month?event=${data.booking.eventSlug}&month=${monthStr}`);
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
		loading = true;

		try {
			const response = await fetch(`/api/availability?event=${data.booking.eventSlug}&date=${dateStr}`);
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

	// Email Verification State
	let enteredEmail = $state('');
	let otpCode = $state('');
	let otpSent = $state(false);
	let sendingOtp = $state(false);
	let verifyingOtp = $state(false);
	let isVerified = $state(false);
	let verificationToken = $state('');
	let otpError = $state('');
	let otpSuccess = $state('');

	async function handleSendOtp() {
		if (!enteredEmail || !enteredEmail.includes('@')) {
			otpError = 'Please enter a valid email address.';
			return;
		}
		otpError = '';
		otpSuccess = '';
		sendingOtp = true;

		try {
			const res = await fetch('/api/otp/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: enteredEmail, purpose: 'reschedule' })
			});
			const result = await res.json() as { success?: boolean; message?: string };
			if (!res.ok) {
				otpError = result.message || 'Failed to send verification code.';
			} else {
				otpSent = true;
				otpSuccess = 'Verification code sent to your email!';
			}
		} catch (err) {
			otpError = 'Network error while sending verification code.';
		} finally {
			sendingOtp = false;
		}
	}

	async function handleVerifyOtp() {
		if (!otpCode || otpCode.trim().length !== 6) {
			otpError = 'Please enter the 6-digit verification code.';
			return;
		}
		otpError = '';
		otpSuccess = '';
		verifyingOtp = true;

		try {
			const res = await fetch('/api/otp/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: enteredEmail, code: otpCode.trim(), purpose: 'reschedule' })
			});
			const result = await res.json() as { success?: boolean; verifiedToken?: string; message?: string };
			if (!res.ok || !result.verifiedToken) {
				otpError = result.message || 'Invalid or expired code.';
			} else {
				verificationToken = result.verifiedToken;
				isVerified = true;
				otpSuccess = 'Email verified successfully!';
			}
		} catch (err) {
			otpError = 'Network error while verifying code.';
		} finally {
			verifyingOtp = false;
		}
	}

	async function handleReschedule() {
		if (!selectedSlot) return;
		if (!isVerified || !verificationToken) {
			rescheduleError = 'Please verify your email address before confirming reschedule.';
			return;
		}

		rescheduleStatus = 'submitting';
		rescheduleError = '';

		try {
			const response = await fetch('/api/bookings/reschedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					bookingId: data.booking.id,
					newStartTime: selectedSlot.start,
					newEndTime: selectedSlot.end,
					timezone: selectedTimezone,
					email: enteredEmail,
					verificationToken
				})
			});

			if (!response.ok) {
				const errData = await response.json() as { message?: string };
				throw new Error(errData.message || 'Failed to reschedule booking');
			}

			const result = await response.json() as { meetingUrl?: string };
			newMeetingUrl = result.meetingUrl || null;
			rescheduleStatus = 'success';
		} catch (error: any) {
			console.error('Reschedule error:', error);
			rescheduleError = error.message || 'Failed to reschedule booking';
			rescheduleStatus = 'error';
		}
	}
</script>

<svelte:head>
	<title>Reschedule Meeting</title>
</svelte:head>

<div
	class="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col items-center justify-center p-4 selection:bg-blue-600/30"
	style="--brand-color: {brandColor}; --brand-light: {colors.light}; --brand-lighter: {colors.lighter}; --brand-dark: {colors.dark}; --brand-rgb: {colors.rgb.r}, {colors.rgb.g}, {colors.rgb.b};"
>
	{#if rescheduleStatus === 'success'}
		<!-- Success Screen -->
		<div class="glass-card rounded-3xl border border-white/10 shadow-2xl p-8 max-w-md w-full">
			<div class="text-center">
				<div class="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
					<svg class="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
					</svg>
				</div>
				<h1 class="text-2xl font-bold text-white mb-2">Meeting Rescheduled!</h1>
				<p class="text-zinc-400 text-sm mb-8">Your meeting has been rescheduled. A calendar update has been sent to your email.</p>

				<div class="bg-white/5 border border-white/10 rounded-2xl p-6 text-left mb-6">
					<h3 class="font-semibold text-white mb-4">{data.booking.eventName}</h3>
					<div class="space-y-3 text-sm">
						<div class="flex items-start gap-3">
							<svg class="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
							</svg>
							<div>
								<p class="text-white font-medium">New Time</p>
								<p class="text-zinc-300">{selectedSlot ? formatTimeRange(selectedSlot.start, selectedSlot.end) : ''}</p>
								<p class="text-zinc-400 text-xs">{selectedDate ? formatSelectedDate(selectedDate) : ''}</p>
							</div>
						</div>
						{#if newMeetingUrl}
							<div class="flex items-start gap-3">
								<svg class="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
								</svg>
								<a href={newMeetingUrl} target="_blank" class="hover:underline break-all text-blue-400 font-medium">{data.booking.inviteCalendar === 'outlook' ? 'Join Microsoft Teams Meeting' : 'Join Google Meet'}</a>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
		<Footer class="mt-6" />
	{:else}
		<!-- Reschedule Form - matching main booking page layout -->
		<div class="glass-card rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex transition-all duration-300 ease-in-out" style="width: {selectedDate ? '920px' : '650px'}">
			<!-- Left Sidebar -->
			<div class="w-72 border-r border-white/10 flex flex-col flex-shrink-0">
				{#if data.booking.coverImage}
					<div class="p-6 pb-4 flex justify-center">
						<img src={data.booking.coverImage} alt="" class="max-h-16 w-auto object-contain" />
					</div>
					<div class="border-b border-white/10 mx-6"></div>
				{/if}

				<div class="flex-1 p-6">
					<div class="mb-6">
						{#if data.booking.profileImage}
							<img src={data.booking.profileImage} alt={data.booking.hostName} class="w-12 h-12 rounded-full object-cover mb-3 border border-white/20" />
						{:else}
							<div class="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg mb-3 border border-white/20" style="background-color: var(--brand-color)">
								{data.booking.hostName?.charAt(0) || 'H'}
							</div>
						{/if}
						<p class="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">{data.booking.hostName}</p>
						<h1 class="text-2xl font-bold text-white tracking-tight">{data.booking.eventName}</h1>
					</div>

					<div class="space-y-4 text-sm text-zinc-300">
						<div class="flex items-center gap-3">
							<svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
							</svg>
							<span>{data.booking.duration} min</span>
						</div>
						<div class="flex items-center gap-3">
							<svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
							</svg>
							<span>{data.booking.inviteCalendar === 'outlook' ? 'Microsoft Teams' : 'Google Meet'}</span>
						</div>
					</div>

					<!-- Current booking info -->
					<div class="mt-6 pt-6 border-t border-white/10">
						<p class="text-xs font-semibold text-zinc-400 uppercase mb-2">Current booking</p>
						<div class="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm">
							<p class="font-medium text-red-300">{formatOriginalDateTime(data.booking.startTime)}</p>
							<p class="text-red-400 text-xs mt-0.5">{data.booking.attendeeName}</p>
							<p class="text-red-400/80 text-xs">{data.booking.attendeeEmail}</p>
						</div>
					</div>

					{#if selectedSlot}
						<div class="mt-4">
							<p class="text-xs font-semibold text-emerald-400 uppercase mb-2">New selected time</p>
							<div class="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-sm">
								<p class="font-medium text-emerald-300">{formatTime(selectedSlot.start)} - {formatTime(selectedSlot.end)}</p>
								<p class="text-emerald-400 text-xs mt-0.5">{selectedDate ? formatSelectedDate(selectedDate) : ''}</p>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Main Content -->
			<div class="flex-1 p-6">
				{#if rescheduleError}
					<div class="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 mb-6 max-w-2xl text-sm">
						{rescheduleError}
					</div>
				{/if}

				<div class="flex items-stretch">
					<div class="w-80">
						<h2 class="text-xl font-semibold text-white mb-6">Select a New Date & Time</h2>

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

						<!-- Timezone selector -->
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
								<span>{selectedTimezone} ({getCurrentTime(selectedTimezone, use12Hour)})</span>
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
						<div class="w-52 ml-6 border-l border-white/10 pl-6 flex flex-col" style="max-height: 400px;">
							<h3 class="text-sm font-medium text-zinc-400 mb-4 flex-shrink-0">
								{formatSelectedDate(selectedDate).split(',')[0]}
							</h3>
							{#if loading}
								<div class="flex items-center justify-center py-8">
									<div class="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent border-blue-500"></div>
								</div>
							{:else if availableSlots.length === 0}
								<p class="text-sm text-zinc-400 py-4">No available times</p>
							{:else}
								<div class="space-y-2 overflow-y-auto flex-1 pr-2 pb-2 scrollbar-thin">
									{#each availableSlots as slot}
										{#if selectedSlot === slot}
											<button type="button" class="w-full py-2.5 px-3 border border-blue-500 bg-blue-600/20 text-blue-400 rounded-xl text-sm font-semibold shadow-sm">
												{formatTime(slot.start)}
											</button>
										{:else}
											<button
												type="button"
												onclick={() => selectSlot(slot)}
												class="w-full py-2.5 px-3 border border-white/10 bg-white/5 text-zinc-300 hover:border-white/20 rounded-xl text-sm font-semibold transition"
											>
												{formatTime(slot.start)}
											</button>
										{/if}
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Reschedule button & verification gate -->
				{#if selectedSlot}
					<div class="mt-6 pt-6 border-t border-white/10 space-y-4">
						<!-- Identity Verification Step -->
						<div class="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
							<div class="flex items-center justify-between">
								<h4 class="text-xs font-bold uppercase tracking-wider text-zinc-300">
									Step: Verify Attendee Email
								</h4>
								{#if isVerified}
									<span class="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
										✓ Verified
									</span>
								{/if}
							</div>

							<p class="text-xs text-zinc-400">
								Please verify the email used for this booking ({data.booking.maskedEmail}) to confirm reschedule:
							</p>

							{#if !isVerified}
								<div class="space-y-2">
									<div class="flex gap-2">
										<input
											type="email"
											bind:value={enteredEmail}
											disabled={otpSent}
											placeholder="Enter your full email"
											class="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
										/>
										{#if !otpSent}
											<button
												type="button"
												onclick={handleSendOtp}
												disabled={sendingOtp}
												class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
											>
												{sendingOtp ? 'Sending...' : 'Send OTP'}
											</button>
										{:else}
											<button
												type="button"
												onclick={() => { otpSent = false; otpCode = ''; }}
												class="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold"
											>
												Change
											</button>
										{/if}
									</div>

									{#if otpSent}
										<div class="flex gap-2 animate-fade-in">
											<input
												type="text"
												maxlength="6"
												bind:value={otpCode}
												placeholder="6-digit code"
												class="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-blue-500/50 text-xs font-mono tracking-widest text-center text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
											/>
											<button
												type="button"
												onclick={handleVerifyOtp}
												disabled={verifyingOtp}
												class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
											>
												{verifyingOtp ? 'Verifying...' : 'Verify'}
											</button>
										</div>
									{/if}

									{#if otpError}
										<div class="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
											{otpError}
										</div>
									{/if}
									{#if otpSuccess}
										<div class="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg">
											{otpSuccess}
										</div>
									{/if}
								</div>
							{:else}
								<div class="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
									<span>Identity confirmed for <strong>{enteredEmail}</strong></span>
									<span class="text-xs font-bold">✓ Ready</span>
								</div>
							{/if}
						</div>

						<button
							onclick={handleReschedule}
							disabled={rescheduleStatus === 'submitting' || !isVerified}
							class="w-full py-3 px-6 text-white rounded-xl font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 hover:opacity-95"
							style="background-color: var(--brand-color, #2563eb)"
						>
							{rescheduleStatus === 'submitting' ? 'Rescheduling...' : 'Confirm Reschedule'}
						</button>
					</div>
				{/if}

				<!-- Cancel link -->
				<div class="mt-4 text-center">
					<a
						href="/cancel/{data.booking.id}"
						class="text-xs text-zinc-500 hover:text-red-400 transition"
					>
						Or cancel this meeting instead
					</a>
				</div>
			</div>
		</div>
		<Footer class="mt-6" />
	{/if}
</div>
