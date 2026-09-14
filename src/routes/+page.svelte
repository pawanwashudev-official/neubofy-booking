<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Active booking wizard step: 1 = Service, 2 = Expert & Duration, 3 = Date & Slot, 4 = Intake & OTP, 5 = Confirmed
	let step = $state<1 | 2 | 3 | 4 | 5>(1);

	// Selected states
	let selectedEvent = $state<any>(null);
	let selectedExpert = $state<any>(null);
	let selectedDuration = $state<number>(30);
	let selectedDate = $state<string>(''); // YYYY-MM-DD
	let selectedSlot = $state<{ start: string; end: string } | null>(null);

	// Availability slot state
	let loadingSlots = $state<boolean>(false);
	let slots = $state<Array<{ start: string; end: string }>>([]);
	let availabilityTimezone = $state<string>('Asia/Kolkata');

	// Intake form fields
	let attendeeName = $state<string>('');
	let attendeeCountryCode = $state<string>('+91');
	let attendeeMobile = $state<string>('');
	let attendeeEmail = $state<string>('');
	let clientGoal = $state<string>('');
	let clientReason = $state<string>('');
	let clientExpectations = $state<string>('');
	let attendeeNotes = $state<string>('');

	// OTP Verification state
	let otpSent = $state<boolean>(false);
	let otpSending = $state<boolean>(false);
	let otpCode = $state<string>('');
	let otpVerifying = $state<boolean>(false);
	let emailVerified = $state<boolean>(false);
	let verificationToken = $state<string>('');
	let otpMessage = $state<string>('');
	let otpError = $state<string>('');
	let resendCountdown = $state<number>(0);

	// Booking submission state
	let submittingBooking = $state<boolean>(false);
	let bookingError = $state<string>('');
	let confirmedBooking = $state<{
		bookingId: string;
		meetingUrl: string | null;
		expertName: string;
		serviceName: string;
		startTime: string;
		endTime: string;
	} | null>(null);

	// Calendar month view state
	let currentCalendarMonth = $state<Date>(new Date());

	// Step 1: Select Event
	function handleSelectEvent(event: any) {
		selectedEvent = event;
		// If event has assigned experts, pick first or let user choose
		if (event.experts && event.experts.length > 0) {
			selectedExpert = event.experts[0];
			selectedDuration = event.durations?.[0] || 30;
		} else if (data.allExperts && data.allExperts.length > 0) {
			selectedExpert = data.allExperts[0];
			selectedDuration = 30;
		}
		step = 2;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	// Step 2: Select Expert & Duration
	function handleSelectExpert(expert: any, duration?: number) {
		selectedExpert = expert;
		if (duration) {
			selectedDuration = duration;
		} else if (expert.session_pricing && expert.session_pricing.length > 0) {
			selectedDuration = expert.session_pricing[0].duration;
		}
		// Set default date to tomorrow or next business day
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		selectedDate = tomorrow.toISOString().split('T')[0];
		fetchAvailabilitySlots();
		step = 3;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	// Fetch slots for selected expert, date and duration
	async function fetchAvailabilitySlots() {
		if (!selectedEvent || !selectedDate) return;
		loadingSlots = true;
		slots = [];
		selectedSlot = null;

		try {
			const expertParam = selectedExpert?.id ? `&expertId=${encodeURIComponent(selectedExpert.id)}` : '';
			const res = await fetch(
				`/api/availability?event=${encodeURIComponent(selectedEvent.slug)}&date=${selectedDate}&duration=${selectedDuration}${expertParam}`
			);
			if (res.ok) {
				const json = await res.json();
				slots = json.slots || [];
				if (json.timezone) availabilityTimezone = json.timezone;
			}
		} catch (err) {
			console.error('Error fetching availability:', err);
		} finally {
			loadingSlots = false;
		}
	}

	// Select Slot -> Proceed to Intake
	function handleSelectSlot(slot: { start: string; end: string }) {
		selectedSlot = slot;
		step = 4;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	// OTP Send
	async function handleSendOtp() {
		if (!attendeeEmail || !attendeeEmail.includes('@')) {
			otpError = 'Please enter a valid email address first.';
			return;
		}
		otpSending = true;
		otpError = '';
		otpMessage = '';

		try {
			const res = await fetch('/api/otp/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: attendeeEmail })
			});
			const json = await res.json();
			if (!res.ok) {
				throw new Error(json.message || 'Failed to send verification code.');
			}
			otpSent = true;
			otpMessage = '6-digit verification code sent to your inbox.';
			resendCountdown = 60;
			const timer = setInterval(() => {
				resendCountdown -= 1;
				if (resendCountdown <= 0) clearInterval(timer);
			}, 1000);
		} catch (err: any) {
			otpError = err.message || 'Error sending verification code.';
		} finally {
			otpSending = false;
		}
	}

	// OTP Verify
	async function handleVerifyOtp() {
		if (!otpCode || otpCode.trim().length !== 6) {
			otpError = 'Please enter the 6-digit verification code.';
			return;
		}
		otpVerifying = true;
		otpError = '';

		try {
			const res = await fetch('/api/otp/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: attendeeEmail, code: otpCode.trim() })
			});
			const json = await res.json();
			if (!res.ok) {
				throw new Error(json.message || 'Verification failed. Invalid code.');
			}
			emailVerified = true;
			verificationToken = json.verifiedToken;
			otpMessage = 'Email verified successfully!';
		} catch (err: any) {
			otpError = err.message || 'Invalid code. Please try again.';
		} finally {
			otpVerifying = false;
		}
	}

	// Submit Final Booking
	async function handleConfirmBooking() {
		if (!emailVerified || !verificationToken) {
			bookingError = 'Please verify your email address using the 6-digit OTP code.';
			return;
		}
		if (!attendeeName.trim()) {
			bookingError = 'Please provide your full name.';
			return;
		}
		if (!selectedSlot) {
			bookingError = 'Please select an appointment time slot.';
			return;
		}

		submittingBooking = true;
		bookingError = '';

		const fullPhone = attendeeMobile.trim() ? `${attendeeCountryCode} ${attendeeMobile.trim()}` : '';

		try {
			const res = await fetch('/api/bookings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					eventSlug: selectedEvent.slug,
					expertUserId: selectedExpert?.id,
					startTime: selectedSlot.start,
					endTime: selectedSlot.end,
					durationMinutes: selectedDuration,
					attendeeName: attendeeName.trim(),
					attendeeEmail: attendeeEmail.trim().toLowerCase(),
					attendeePhone: fullPhone,
					goal: clientGoal.trim(),
					reason: clientReason.trim(),
					expectations: clientExpectations.trim(),
					notes: attendeeNotes.trim(),
					verificationToken,
					timezone: availabilityTimezone
				})
			});

			const json = await res.json();
			if (!res.ok) {
				throw new Error(json.message || 'Failed to confirm booking.');
			}

			confirmedBooking = {
				bookingId: json.bookingId,
				meetingUrl: json.meetingUrl,
				expertName: json.expertName || selectedExpert?.name,
				serviceName: json.serviceName || selectedEvent.name,
				startTime: json.startTime || selectedSlot.start,
				endTime: json.endTime || selectedSlot.end
			};
			step = 5;
			window.scrollTo({ top: 0, behavior: 'smooth' });
		} catch (err: any) {
			bookingError = err.message || 'Could not schedule booking. Please try another slot.';
		} finally {
			submittingBooking = false;
		}
	}

	function resetBooking() {
		step = 1;
		selectedEvent = null;
		selectedExpert = null;
		selectedSlot = null;
		emailVerified = false;
		verificationToken = '';
		otpCode = '';
		otpSent = false;
		confirmedBooking = null;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	// Calendar helper functions
	function getDaysInMonth(year: number, month: number) {
		return new Date(year, month + 1, 0).getDate();
	}

	function getFirstDayOfMonth(year: number, month: number) {
		return new Date(year, month, 1).getDay();
	}

	function prevMonth() {
		currentCalendarMonth = new Date(
			currentCalendarMonth.getFullYear(),
			currentCalendarMonth.getMonth() - 1,
			1
		);
	}

	function nextMonth() {
		currentCalendarMonth = new Date(
			currentCalendarMonth.getFullYear(),
			currentCalendarMonth.getMonth() + 1,
			1
		);
	}

	function formatTimeSlot(isoString: string) {
		const d = new Date(isoString);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
	}

	function formatDateNice(isoDate: string) {
		const d = new Date(isoDate);
		return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>Consultations & Strategy Advisory | Neubofy™</title>
	<meta
		name="description"
		content="Book a specialized technology consultation with Neubofy's expert members. Architecture, AI automations, systems integration, code audit, and strategy."
	/>
</svelte:head>

<!-- Top Navbar matching neubofy.in -->
<header class="border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-50">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
		<a href="/" class="flex items-center space-x-3 group">
			<img
				src={data.organization?.profile_image || 'https://neubofy.in/neubofylogo.png'}
				alt="Neubofy Logo"
				class="w-9 h-9 rounded-full object-cover border border-white/20 group-hover:scale-105 transition-transform"
			/>
			<div>
				<span class="text-xl font-bold text-white tracking-tight">Neubofy™</span>
				<span class="hidden sm:inline-block ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
					Consulting
				</span>
			</div>
		</a>

		<div class="flex items-center space-x-4 sm:space-x-6">
			<a
				href="https://neubofy.in"
				target="_blank"
				rel="noreferrer"
				class="text-sm font-medium text-zinc-400 hover:text-white transition-colors hidden md:inline-block"
			>
				Main Website
			</a>
			<a
				href="https://neubofy.zohodesk.in/portal"
				target="_blank"
				rel="noreferrer"
				class="text-sm font-medium text-zinc-400 hover:text-white transition-colors hidden sm:inline-block"
			>
				Help Centre
			</a>
			<a
				href="/dashboard"
				class="inline-flex items-center justify-center px-4 py-2 text-xs sm:text-sm font-medium rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all"
			>
				Expert Portal →
			</a>
		</div>
	</div>
</header>

<main class="min-h-[calc(100vh-80px)] bg-[#09090b] text-zinc-100 relative overflow-hidden py-10 sm:py-16">
	<!-- Background Ambient Glows -->
	<div class="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
	<div class="absolute top-40 right-10 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

	<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
		<!-- Progress Indicator -->
		{#if step < 5}
			<div class="mb-10 max-w-3xl mx-auto">
				<div class="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3 px-1">
					<span class={step >= 1 ? 'text-blue-400 font-bold' : ''}>1. Service</span>
					<span class={step >= 2 ? 'text-blue-400 font-bold' : ''}>2. Expert & Duration</span>
					<span class={step >= 3 ? 'text-blue-400 font-bold' : ''}>3. Date & Time</span>
					<span class={step >= 4 ? 'text-blue-400 font-bold' : ''}>4. Verification</span>
				</div>
				<div class="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
					<div
						class="bg-blue-600 h-full transition-all duration-300 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.8)]"
						style="width: {((step - 1) / 3) * 100}%"
					></div>
				</div>
			</div>
		{/if}

		<!-- ========================================================= -->
		<!-- STEP 1: SERVICE SELECTION -->
		<!-- ========================================================= -->
		{#if step === 1}
			<div class="text-center max-w-3xl mx-auto mb-12 animate-fade-in">
				<div class="inline-flex items-center gap-2 glass-card px-4 py-1.5 rounded-full mb-6 border border-white/10">
					<span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
					<span class="text-xs font-semibold tracking-wider uppercase text-zinc-300">
						Technology, Without the Guesswork.
					</span>
				</div>
				<h1 class="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-4 leading-tight">
					Book a Specialized Consultation
				</h1>
				<p class="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto">
					Select your technology requirement below. All strategy sessions are currently complimentary.
				</p>
			</div>

			{#if data.eventTypes && data.eventTypes.length > 0}
				<!-- Consultation Event Cards -->
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in mt-8">
					{#each data.eventTypes as eventType}
						<div
							class="glass-card-interactive rounded-2xl p-6 sm:p-7 flex flex-col justify-between relative group border border-white/10"
						>
							<div>
								<div class="flex items-center justify-between mb-4">
									<span class="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-md bg-white/5 border border-white/10 text-zinc-300">
										{eventType.category || 'Consultation'}
									</span>
									<span class="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
										Complimentary
									</span>
								</div>

								<h3 class="text-xl font-bold text-white group-hover:text-blue-400 transition-colors mb-2 leading-snug">
									{eventType.name}
								</h3>
								<p class="text-sm text-zinc-400 line-clamp-3 mb-6 leading-relaxed">
									{eventType.description || 'Specialized consultation session.'}
								</p>
							</div>

							<div class="pt-4 border-t border-white/10">
								<div class="flex items-center justify-between text-xs text-zinc-400 mb-4">
									<span class="flex items-center gap-1.5">
										<svg class="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
										{eventType.durations ? eventType.durations.join(' / ') : 30} mins
									</span>
									<span class="text-zinc-500">
										{eventType.experts?.length || data.allExperts?.length || 1} specialist(s)
									</span>
								</div>

								<button
									type="button"
									onclick={() => handleSelectEvent(eventType)}
									class="w-full btn-electric py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 group-hover:shadow-[0_0_24px_rgba(59,130,246,0.6)]"
								>
									Select Service & Choose Expert →
								</button>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<!-- Clean, Empty Manual State -->
				<div class="glass-card rounded-3xl p-10 sm:p-14 text-center border border-white/10 max-w-lg mx-auto space-y-4 animate-fade-in mt-8">
					<div class="w-16 h-16 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-3xl">
						📅
					</div>
					<h3 class="text-xl font-bold text-white">No Consultation Services Listed Yet</h3>
					<p class="text-xs sm:text-sm text-zinc-400 leading-relaxed">
						There are currently no active consultation services. Organization administrators and experts can create and configure consultation services manually in the Expert Portal.
					</p>
					<div class="pt-3">
						<a
							href="/dashboard"
							class="btn-electric px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-[0_0_24px_rgba(59,130,246,0.4)]"
						>
							<span>Access Expert Portal</span>
							<span>→</span>
						</a>
					</div>
				</div>
			{/if}
		{/if}

		<!-- ========================================================= -->
		<!-- STEP 2: EXPERT & DURATION SELECTION -->
		<!-- ========================================================= -->
		{#if step === 2 && selectedEvent}
			<div class="max-w-4xl mx-auto animate-fade-in">
				<button
					type="button"
					onclick={() => (step = 1)}
					class="inline-flex items-center text-xs font-semibold text-zinc-400 hover:text-white mb-6 transition-colors"
				>
					← Back to All Services
				</button>

				<!-- Selected Service Banner -->
				<div class="glass-card rounded-2xl p-6 mb-8 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
					<div>
						<div class="flex items-center gap-2 mb-1.5">
							<span class="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
								{selectedEvent.category}
							</span>
							<span class="text-xs text-zinc-400">• Complimentary Consultation</span>
						</div>
						<h2 class="text-2xl font-bold text-white">{selectedEvent.name}</h2>
					</div>
					<button
						type="button"
						onclick={() => (step = 1)}
						class="text-xs font-medium text-blue-400 hover:underline shrink-0"
					>
						Change Service
					</button>
				</div>

				<div class="mb-6">
					<h3 class="text-xl font-bold text-white mb-1">Choose a Neubofy Expert</h3>
					<p class="text-sm text-zinc-400">
						Select a specialist and your preferred session duration. All consultation fees are 100% waived.
					</p>
				</div>

				<!-- Expert Cards List -->
				<div class="space-y-4">
					{#each selectedEvent.experts && selectedEvent.experts.length > 0 ? selectedEvent.experts : data.allExperts as expert}
						<div class="glass-card rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all">
							<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
								<div class="flex items-start gap-4">
									{#if expert.profile_image}
										<img
											src={expert.profile_image}
											alt={expert.name}
											class="w-16 h-16 rounded-2xl object-cover border border-white/10 shrink-0"
										/>
									{:else}
										<div
											class="w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-xl text-white border border-white/10 shrink-0"
											style="background: {expert.brand_color || '#2563eb'}"
										>
											{expert.name?.charAt(0) || 'E'}
										</div>
									{/if}

									<div>
										<h4 class="text-lg font-bold text-white mb-0.5">{expert.name}</h4>
										<p class="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-2">
											{expert.role_title || 'Technology Consultant'}
										</p>
										<p class="text-xs text-zinc-400 max-w-xl line-clamp-2">
											{expert.bio || 'Specialist at Neubofy translating business requirements into technical reality.'}
										</p>
									</div>
								</div>

								<!-- Session Durations & Free Badge -->
								<div class="w-full sm:w-auto flex flex-col items-end gap-3 shrink-0">
									<div class="flex flex-wrap gap-2">
										{#each expert.session_pricing && expert.session_pricing.length > 0 ? expert.session_pricing : (selectedEvent.durations || [30]).map((d) => ({ duration: d, price: 0 })) as tier}
											<button
												type="button"
												onclick={() => handleSelectExpert(expert, tier.duration)}
												class="px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all text-left flex flex-col {selectedExpert?.id === expert.id && selectedDuration === tier.duration
													? 'bg-blue-600/30 border-blue-500 text-white shadow-[0_0_16px_rgba(59,130,246,0.3)]'
													: 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'}"
											>
												<span class="font-bold">{tier.duration} Mins</span>
												{#if tier.price > 0}
													<span class="text-[11px] text-zinc-400 line-through">₹{tier.price}</span>
												{/if}
												<span class="text-[11px] text-emerald-400 font-bold">Complimentary</span>
											</button>
										{/each}
									</div>

									<button
										type="button"
										onclick={() => handleSelectExpert(expert, selectedDuration)}
										class="w-full sm:w-auto btn-electric px-5 py-2.5 rounded-xl text-xs font-bold"
									>
										Check Schedule & Book →
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- ========================================================= -->
		<!-- STEP 3: DATE & TIME SLOT PICKER -->
		<!-- ========================================================= -->
		{#if step === 3 && selectedEvent && selectedExpert}
			<div class="max-w-4xl mx-auto animate-fade-in">
				<button
					type="button"
					onclick={() => (step = 2)}
					class="inline-flex items-center text-xs font-semibold text-zinc-400 hover:text-white mb-6 transition-colors"
				>
					← Back to Expert Selection
				</button>

				<!-- Summary Header -->
				<div class="glass-card rounded-2xl p-6 mb-8 border border-white/10 flex flex-wrap items-center justify-between gap-4">
					<div>
						<span class="text-xs font-semibold text-blue-400 uppercase tracking-wider">
							Step 3 &bull; Select Date & Time
						</span>
						<h2 class="text-2xl font-bold text-white mt-0.5">
							{selectedEvent.name}
						</h2>
						<p class="text-xs text-zinc-400 mt-1">
							Consultant: <strong class="text-zinc-200">{selectedExpert.name}</strong> ({selectedExpert.role_title || 'Consultant'}) &bull;
							Duration: <strong class="text-zinc-200">{selectedDuration} Mins</strong> &bull;
							<span class="text-emerald-400 font-semibold">Complimentary</span>
						</p>
					</div>
					<div class="text-xs text-zinc-400 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
						Timezone: <strong>{availabilityTimezone}</strong>
					</div>
				</div>

				<!-- Interactive Calendar and Slot Grid -->
				<div class="grid grid-cols-1 md:grid-cols-12 gap-8">
					<!-- Month Calendar (7 cols) -->
					<div class="md:col-span-7 glass-card rounded-2xl p-6 border border-white/10">
						<div class="flex items-center justify-between mb-6">
							<h3 class="text-base font-bold text-white">
								{currentCalendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
							</h3>
							<div class="flex items-center space-x-2">
								<button
									type="button"
									onclick={prevMonth}
									class="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 text-xs"
								>
									←
								</button>
								<button
									type="button"
									onclick={nextMonth}
									class="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 text-xs"
								>
									→
								</button>
							</div>
						</div>

						<!-- Days of week -->
						<div class="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-zinc-500 mb-2">
							<span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
						</div>

						<!-- Days grid -->
						<div class="grid grid-cols-7 gap-1 text-center">
							<!-- Leading empty cells -->
							{#each Array(getFirstDayOfMonth(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth())) as _}
								<div class="p-2"></div>
							{/each}

							{#each Array(getDaysInMonth(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth())) as _, i}
								{@const day = i + 1}
								{@const dateObj = new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth(), day)}
								{@const dateStr = `${currentCalendarMonth.getFullYear()}-${String(currentCalendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`}
								{@const isPast = dateObj.getTime() < new Date().setHours(0, 0, 0, 0)}
								{@const isSelected = selectedDate === dateStr}

								<button
									type="button"
									disabled={isPast}
									onclick={() => {
										selectedDate = dateStr;
										fetchAvailabilitySlots();
									}}
									class="p-2.5 rounded-xl text-xs font-medium transition-all {isSelected
										? 'bg-blue-600 text-white font-bold shadow-[0_0_16px_rgba(37,99,235,0.6)]'
										: isPast
											? 'text-zinc-600 cursor-not-allowed'
											: 'text-zinc-300 hover:bg-white/10 hover:text-white'}"
								>
									{day}
								</button>
							{/each}
						</div>
					</div>

					<!-- Available Slots Column (5 cols) -->
					<div class="md:col-span-5 glass-card rounded-2xl p-6 border border-white/10 flex flex-col">
						<h3 class="text-base font-bold text-white mb-1">Available Times</h3>
						<p class="text-xs text-zinc-400 mb-4">
							{selectedDate ? formatDateNice(selectedDate) : 'Select a date'}
						</p>

						{#if loadingSlots}
							<div class="space-y-2.5 py-1">
								<div class="flex items-center gap-2 mb-3 text-[11px] text-blue-400">
									<div class="w-2 h-2 rounded-full bg-blue-500 animate-ping"></div>
									<span>Checking {selectedExpert.name}'s live calendar & busy slots...</span>
								</div>
								{#each Array(5) as _}
									<div class="h-10 rounded-xl skeleton-shimmer w-full border border-white/5"></div>
								{/each}
							</div>
						{:else if slots.length > 0}
							<div class="space-y-2 overflow-y-auto max-h-80 pr-1 scrollbar-thin">
								{#each slots as slot}
									<button
										type="button"
										onclick={() => handleSelectSlot(slot)}
										class="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-white/5 hover:bg-blue-600 hover:text-white text-zinc-200 border border-white/10 transition-all flex items-center justify-between group"
									>
										<span>{formatTimeSlot(slot.start)}</span>
										<span class="text-[10px] text-zinc-400 group-hover:text-blue-100">Select →</span>
									</button>
								{/each}
							</div>
						{:else}
							<div class="flex-1 flex flex-col items-center justify-center py-12 text-zinc-500 text-xs text-center">
								<p>No available consultation slots on this date.</p>
								<p class="text-zinc-600 mt-1">Please select another date on the calendar.</p>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- ========================================================= -->
		<!-- STEP 4: VERIFICATION & QUESTIONNAIRE INTAKE -->
		<!-- ========================================================= -->
		{#if step === 4 && selectedEvent && selectedExpert && selectedSlot}
			<div class="max-w-2xl mx-auto animate-fade-in">
				<button
					type="button"
					onclick={() => (step = 3)}
					class="inline-flex items-center text-xs font-semibold text-zinc-400 hover:text-white mb-6 transition-colors"
				>
					← Back to Time Slot Selection
				</button>

				<!-- Session Summary Box -->
				<div class="glass-card rounded-2xl p-6 mb-8 border border-white/10">
					<div class="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
						<div>
							<span class="text-[10px] uppercase font-bold tracking-wider text-blue-400">Consultation Session</span>
							<h3 class="text-xl font-bold text-white">{selectedEvent.name}</h3>
						</div>
						<div class="text-right">
							<span class="text-xs text-emerald-400 font-bold px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
								100% Free
							</span>
						</div>
					</div>

					<div class="grid grid-cols-2 gap-4 text-xs">
						<div>
							<span class="text-zinc-500">Expert Consultant</span>
							<p class="font-semibold text-zinc-200 mt-0.5">{selectedExpert.name}</p>
						</div>
						<div>
							<span class="text-zinc-500">Duration</span>
							<p class="font-semibold text-zinc-200 mt-0.5">{selectedDuration} Minutes</p>
						</div>
						<div>
							<span class="text-zinc-500">Date & Time</span>
							<p class="font-semibold text-zinc-200 mt-0.5">
								{formatDateNice(selectedSlot.start)} at {formatTimeSlot(selectedSlot.start)}
							</p>
						</div>
						<div>
							<span class="text-zinc-500">Meeting Platform</span>
							<p class="font-semibold text-zinc-200 mt-0.5">Google Meet (Auto-generated)</p>
						</div>
					</div>
				</div>

				<!-- Intake & Verification Form -->
				<div class="glass-card rounded-2xl p-6 sm:p-8 border border-white/10 space-y-6">
					<div>
						<h3 class="text-lg font-bold text-white">Your Information & Verification</h3>
						<p class="text-xs text-zinc-400">Please provide your details and verify your email via 6-digit OTP.</p>
					</div>

					<!-- Name & Mobile -->
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label for="attendee-name" class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
								Full Name <span class="text-red-400">*</span>
							</label>
							<input
								id="attendee-name"
								type="text"
								bind:value={attendeeName}
								placeholder="e.g. Rahul Sharma"
								required
								class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
							/>
						</div>

						<div>
							<label for="attendee-phone" class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
								Mobile / WhatsApp Number <span class="text-red-400">*</span>
							</label>
							<div class="flex gap-2">
								<select
									bind:value={attendeeCountryCode}
									class="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs outline-none"
								>
									<option value="+91">🇮🇳 +91</option>
									<option value="+1">🇺🇸 +1</option>
									<option value="+44">🇬🇧 +44</option>
									<option value="+971">🇦🇪 +971</option>
									<option value="+65">🇸🇬 +65</option>
								</select>
								<input
									id="attendee-phone"
									type="tel"
									bind:value={attendeeMobile}
									placeholder="98765 43210"
									required
									class="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-blue-500 outline-none"
								/>
							</div>
						</div>
					</div>

					<!-- Email & Strict OTP Verification -->
					<div class="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
						<label for="attendee-email" class="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
							Email Address (Strict Verification) <span class="text-red-400">*</span>
						</label>

						<div class="flex flex-col sm:flex-row gap-2">
							<input
								id="attendee-email"
								type="email"
								disabled={emailVerified}
								bind:value={attendeeEmail}
								placeholder="you@company.com"
								class="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none disabled:opacity-60"
							/>
							{#if !emailVerified}
								<button
									type="button"
									disabled={otpSending || resendCountdown > 0}
									onclick={handleSendOtp}
									class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all disabled:opacity-50 shrink-0"
								>
									{otpSending
										? 'Sending...'
										: resendCountdown > 0
											? `Resend (${resendCountdown}s)`
											: otpSent
												? 'Resend OTP'
												: 'Send OTP Code'}
								</button>
							{:else}
								<div class="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shrink-0">
									✓ Verified
								</div>
							{/if}
						</div>

						<!-- OTP Input Box -->
						{#if otpSent && !emailVerified}
							<div class="pt-2 flex flex-col sm:flex-row gap-2">
								<input
									type="text"
									maxLength={6}
									bind:value={otpCode}
									placeholder="Enter 6-digit OTP code"
									class="w-full sm:w-48 px-4 py-2.5 text-center font-mono text-base tracking-widest rounded-xl bg-white/10 border border-blue-500/40 text-white outline-none"
								/>
								<button
									type="button"
									disabled={otpVerifying || otpCode.trim().length !== 6}
									onclick={handleVerifyOtp}
									class="btn-electric px-6 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50"
								>
									{otpVerifying ? 'Verifying...' : 'Verify OTP'}
								</button>
							</div>
						{/if}

						{#if otpMessage}
							<p class="text-xs text-emerald-400">{otpMessage}</p>
						{/if}
						{#if otpError}
							<p class="text-xs text-red-400">{otpError}</p>
						{/if}
					</div>

					<!-- 3 Consultation Intake Questions -->
					<div class="space-y-4 pt-2">
						<h4 class="text-xs font-bold uppercase tracking-wider text-zinc-300">
							Consultation Objectives & Expectations
						</h4>

						<div>
							<label for="client-goal" class="block text-xs font-medium text-zinc-400 mb-1">
								1. What is your primary business or technical goal? <span class="text-red-400">*</span>
							</label>
							<textarea
								id="client-goal"
								bind:value={clientGoal}
								rows={2}
								placeholder="e.g. Build an AI-driven workflow automation / modernize our cloud architecture..."
								class="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs outline-none focus:border-blue-500"
							></textarea>
						</div>

						<div>
							<label for="client-reason" class="block text-xs font-medium text-zinc-400 mb-1">
								2. Why do you want this consultation right now? <span class="text-red-400">*</span>
							</label>
							<textarea
								id="client-reason"
								bind:value={clientReason}
								rows={2}
								placeholder="e.g. We are facing integration bottlenecks / need independent architectural verification..."
								class="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs outline-none focus:border-blue-500"
							></textarea>
						</div>

						<div>
							<label for="client-expectations" class="block text-xs font-medium text-zinc-400 mb-1">
								3. What are your key expectations from our expert? <span class="text-red-400">*</span>
							</label>
							<textarea
								id="client-expectations"
								bind:value={clientExpectations}
								rows={2}
								placeholder="e.g. Actionable roadmap, build vs buy comparison, and technical feasibility audit..."
								class="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs outline-none focus:border-blue-500"
							></textarea>
						</div>

						<div>
							<label for="attendee-notes" class="block text-xs font-medium text-zinc-400 mb-1">
								Additional Notes or Links (Optional)
							</label>
							<input
								id="attendee-notes"
								type="text"
								bind:value={attendeeNotes}
								placeholder="GitHub repos, architecture docs, or specific questions..."
								class="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs outline-none"
							/>
						</div>
					</div>

					{#if bookingError}
						<div class="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
							{bookingError}
						</div>
					{/if}

					<!-- Submit Button -->
					<div class="pt-4 border-t border-white/10">
						<button
							type="button"
							disabled={submittingBooking || !emailVerified}
							onclick={handleConfirmBooking}
							class="w-full btn-electric py-3.5 px-6 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
						>
							{#if submittingBooking}
								<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
								Scheduling Meeting...
							{:else}
								Confirm & Schedule Consultation (Free) →
							{/if}
						</button>
						{#if !emailVerified}
							<p class="text-[11px] text-zinc-500 text-center mt-2">
								* Please verify your email with the 6-digit OTP code above to enable scheduling.
							</p>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- ========================================================= -->
		<!-- STEP 5: CELEBRATORY CONFIRMATION -->
		<!-- ========================================================= -->
		{#if step === 5 && confirmedBooking}
			<div class="max-w-xl mx-auto text-center animate-fade-in">
				<div class="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-3xl shadow-[0_0_32px_rgba(16,185,129,0.3)]">
					✓
				</div>

				<h1 class="text-3xl sm:text-4xl font-bold text-white mb-2">
					Consultation Confirmed!
				</h1>
				<p class="text-sm text-zinc-400 mb-8">
					Your session with Neubofy has been successfully scheduled. Details and Google Meet invites have been dispatched.
				</p>

				<div class="glass-card rounded-2xl p-6 sm:p-7 mb-8 border border-white/10 text-left space-y-4">
					<div class="flex items-center justify-between pb-3 border-b border-white/10">
						<div>
							<span class="text-[10px] uppercase font-bold text-blue-400">Service</span>
							<p class="text-base font-bold text-white">{confirmedBooking.serviceName}</p>
						</div>
						<span class="px-2.5 py-1 text-xs font-bold rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
							Confirmed
						</span>
					</div>

					<div class="grid grid-cols-2 gap-4 text-xs">
						<div>
							<span class="text-zinc-500">Expert Host</span>
							<p class="font-semibold text-zinc-200 mt-0.5">{confirmedBooking.expertName}</p>
						</div>
						<div>
							<span class="text-zinc-500">Duration</span>
							<p class="font-semibold text-zinc-200 mt-0.5">{selectedDuration} Minutes</p>
						</div>
						<div class="col-span-2">
							<span class="text-zinc-500">Scheduled Time</span>
							<p class="font-semibold text-zinc-200 mt-0.5">
								{formatDateNice(confirmedBooking.startTime)} &bull; {formatTimeSlot(confirmedBooking.startTime)} ({availabilityTimezone})
							</p>
						</div>
					</div>

					{#if confirmedBooking.meetingUrl}
						<div class="pt-4 border-t border-white/10">
							<a
								href={confirmedBooking.meetingUrl}
								target="_blank"
								rel="noreferrer"
								class="w-full btn-electric py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2"
							>
								<span>Join Google Meet Room →</span>
							</a>
						</div>
					{/if}
				</div>

				<div class="flex flex-col sm:flex-row gap-3 justify-center">
					<button
						type="button"
						onclick={resetBooking}
						class="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/10 transition-all"
					>
						Book Another Consultation
					</button>
					<a
						href="https://neubofy.in"
						class="px-6 py-2.5 rounded-xl bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white text-xs font-semibold border border-white/10 transition-all"
					>
						Return to Neubofy.in
					</a>
				</div>
			</div>
		{/if}
	</div>
</main>
