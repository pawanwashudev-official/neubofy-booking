<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import {
		clientUser,
		clientAuthLoading,
		getFirebaseAuth,
		signInWithGoogle,
		signInWithEmail,
		signUpWithEmail,
		signOutClient,
		syncBookingToFirestore
	} from '$lib/firebase/client';

	let { data }: { data: PageData } = $props();

	// Active booking wizard step: 1 = Service, 2 = Expert & Duration, 3 = Date & Slot, 4 = Intake & Payment, 5 = Confirmed
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

	// Client Firebase Auth Modal / Form state
	let authMode = $state<'login' | 'signup'>('login');
	let authEmail = $state<string>('');
	let authPassword = $state<string>('');
	let authName = $state<string>('');
	let authError = $state<string>('');
	let authSubmitting = $state<boolean>(false);

	// Pricing & Coupon state
	let couponInput = $state<string>('');
	let couponValidating = $state<boolean>(false);
	let appliedCoupon = $state<{
		code: string;
		discountAmount: number;
		finalPrice: number;
		isComplimentary: boolean;
		message: string;
	} | null>(null);
	let couponError = $state<string>('');

	// Reactive Expert-Driven Base Price based on selectedDuration
	const currentBasePrice = $derived.by(() => {
		if (selectedExpert?.session_pricing && selectedExpert.session_pricing.length > 0) {
			const tier = selectedExpert.session_pricing.find((t: any) => Number(t.duration) === Number(selectedDuration)) || selectedExpert.session_pricing[0];
			if (tier && typeof tier.price === 'number') return tier.price;
		}
		return selectedEvent?.price_inr || 0;
	});

	const currentFinalPrice = $derived(
		appliedCoupon ? appliedCoupon.finalPrice : currentBasePrice
	);

	onMount(() => {
		getFirebaseAuth();
	});

	// Auto-fill attendee details from Firebase user profile
	$effect(() => {
		if ($clientUser) {
			if (!attendeeName && $clientUser.displayName) attendeeName = $clientUser.displayName;
			if (!attendeeEmail && $clientUser.email) attendeeEmail = $clientUser.email;
		}
	});

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

	// FAQ Accordion state for AEO
	let openFaqIndex = $state<number | null>(null);
	function toggleFaq(index: number) {
		openFaqIndex = openFaqIndex === index ? null : index;
	}

	// Step 1: Select Event
	function handleSelectEvent(event: any) {
		selectedEvent = event;
		// Pick first assigned expert if available, otherwise null
		if (event.experts && event.experts.length > 0) {
			selectedExpert = event.experts[0];
			selectedDuration = event.durations?.[0] || 30;
		} else {
			selectedExpert = null;
			selectedDuration = event.durations?.[0] || 30;
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
				const json = (await res.json()) as any;
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

	// Coupon Validation
	async function applyCoupon(codeToApply?: string) {
		const targetCode = (codeToApply || couponInput).trim();
		if (!targetCode) {
			couponError = 'Please enter a coupon code.';
			return;
		}

		couponValidating = true;
		couponError = '';

		try {
			const res = await fetch('/api/coupons/validate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					code: targetCode,
					eventSlug: selectedEvent?.slug,
					expertUserId: selectedExpert?.id,
					durationMinutes: selectedDuration
				})
			});

			const json = (await res.json()) as any;
			if (!res.ok) {
				throw new Error(json.message || 'Invalid coupon code.');
			}

			appliedCoupon = {
				code: json.code,
				discountAmount: json.discountAmount,
				finalPrice: json.finalPrice,
				isComplimentary: json.isComplimentary,
				message: json.message
			};
			couponInput = json.code;
		} catch (err: any) {
			couponError = err.message || 'Failed to apply coupon.';
			appliedCoupon = null;
		} finally {
			couponValidating = false;
		}
	}

	function removeCoupon() {
		appliedCoupon = null;
		couponInput = '';
		couponError = '';
	}

	// Submit Final Booking
	async function handleConfirmBooking() {
		if (!$clientUser) {
			bookingError = 'Please sign in or create an account to complete your booking.';
			return;
		}
		
		if (!attendeeName?.trim()) {
			attendeeName = $clientUser.displayName || $clientUser.email?.split('@')[0] || 'Valued Client';
		}
		if (!attendeeEmail?.trim()) {
			attendeeEmail = $clientUser.email || '';
		}
		if (!attendeeEmail.trim()) {
			bookingError = 'Verified client email required.';
			return;
		}
		if (!selectedSlot) {
			bookingError = 'Please select an appointment time slot.';
			return;
		}

		// Check if paid consultation requires coupon waiver
		if (currentFinalPrice > 0) {
			bookingError = 'Please apply the 100% OFF coupon code (NEUBOFYVIP) to complete your complimentary consultation waiver.';
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
					couponCode: appliedCoupon?.code || (currentBasePrice === 0 ? 'NEUBOFYVIP' : undefined),
					clientFirebaseUid: $clientUser.uid,
					timezone: availabilityTimezone
				})
			});

			const json = (await res.json()) as any;
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

			// Sync booking into Firestore under client profile
			await syncBookingToFirestore({
				clientUid: $clientUser.uid,
				bookingId: json.bookingId,
				attendeeName: attendeeName.trim(),
				attendeeEmail: attendeeEmail.trim().toLowerCase(),
				attendeePhone: fullPhone,
				eventSlug: selectedEvent.slug,
				eventName: selectedEvent.name,
				expertName: selectedExpert?.name || 'Neubofy Specialist',
				expertId: selectedExpert?.id || '',
				startTime: selectedSlot.start,
				endTime: selectedSlot.end,
				durationMinutes: selectedDuration,
				priceAmount: currentFinalPrice,
				couponCode: appliedCoupon?.code,
				meetingUrl: json.meetingUrl
			});

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
		appliedCoupon = null;
		couponInput = '';
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
	<title>Book Technology Strategy & Architecture Consultation | Neubofy™</title>
	<meta
		name="description"
		content="Book a specialized technology consultation with Neubofy. We act as your external technology department — translating business problems into architecture, AI automation, software integrations, and verified execution."
	/>
	<meta name="keywords" content="technology consulting, external technology department, software architecture consultation, AI automation advisory, systems integration, code audit, technology orchestration, Neubofy" />
	<meta name="author" content="Neubofy" />
	<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
	<link rel="canonical" href="https://booking.neubofy.in/" />

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Neubofy™" />
	<meta property="og:url" content="https://booking.neubofy.in/" />
	<meta property="og:title" content="Book Technology Strategy & Architecture Consultation | Neubofy™" />
	<meta property="og:description" content="Your Technology Department, Without Building One. Book strategy advisory sessions on software architecture, AI automation, system integrations, and independent verification." />
	<meta property="og:image" content="https://neubofy.in/neubofylogo.png" />
	<meta property="og:image:alt" content="Neubofy Logo" />
	<meta property="og:locale" content="en_US" />

	<!-- Twitter Cards -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:site" content="@neubofy" />
	<meta name="twitter:creator" content="@neubofy" />
	<meta name="twitter:title" content="Book Technology Strategy Consultation | Neubofy™" />
	<meta name="twitter:description" content="Your Technology Department, Without Building One. Schedule 1-on-1 strategy and architecture consultations with Neubofy experts." />
	<meta name="twitter:image" content="https://neubofy.in/neubofylogo.png" />

	<!-- Schema.org JSON-LD Structured Data for Organization, Service, and AEO FAQ -->
	{@html `<script type="application/ld+json">
	${JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'Organization',
				'@id': 'https://neubofy.in/#organization',
				'name': 'Neubofy™',
				'url': 'https://neubofy.in',
				'logo': 'https://neubofy.in/neubofylogo.png',
				'description': 'Neubofy is a technology consultancy that acts as an external technology department for businesses. We translate business problems into technology requirements, orchestrate independent specialists, and verify results before delivery.',
				'sameAs': [
					'https://twitter.com/neubofy',
					'https://linkedin.com/company/neubofy',
					'https://instagram.com/neubofy',
					'https://t.me/neubofy'
				],
				'contactPoint': [
					{
						'@type': 'ContactPoint',
						'email': 'meet@neubofy.in',
						'contactType': 'consultations & appointments'
					},
					{
						'@type': 'ContactPoint',
						'email': 'support@neubofy.in',
						'contactType': 'customer support'
					},
					{
						'@type': 'ContactPoint',
						'email': 'services@neubofy.in',
						'contactType': 'services & delivery'
					},
					{
						'@type': 'ContactPoint',
						'email': 'contact@neubofy.in',
						'contactType': 'general inquiries'
					}
				]
			},
			{
				'@type': 'WebSite',
				'@id': 'https://booking.neubofy.in/#website',
				'url': 'https://booking.neubofy.in',
				'name': 'Neubofy Consultation Portal',
				'publisher': {
					'@id': 'https://neubofy.in/#organization'
				}
			},
			{
				'@type': 'ProfessionalService',
				'@id': 'https://booking.neubofy.in/#service',
				'name': 'Neubofy Strategic Technology Consultation',
				'url': 'https://booking.neubofy.in',
				'image': 'https://neubofy.in/neubofylogo.png',
				'provider': {
					'@id': 'https://neubofy.in/#organization'
				},
				'serviceType': [
					'Technology Strategy Consultation',
					'Software Architecture Advisory',
					'AI Systems & Workflow Automation',
					'Systems Integration & APIs',
					'Code Quality & Security Audit'
				],
				'areaServed': 'Global',
				'priceRange': 'Complimentary Strategy Consultations & Advisory Tiers'
			},
			{
				'@type': 'FAQPage',
				'@id': 'https://booking.neubofy.in/#faq',
				'mainEntity': [
					{
						'@type': 'Question',
						'name': 'What is Neubofy and how does a consultation help my business?',
						'acceptedAnswer': {
							'@type': 'Answer',
							'text': 'Neubofy functions as your external technology department. Instead of hiring an expensive in-house engineering executive or managing multiple freelancers yourself, Neubofy translates your business problem into precise technical requirements, coordinates vetted independent specialists, and independently verifies the delivered software before handover.'
						}
					},
					{
						'@type': 'Question',
						'name': 'What technology areas can I consult on with Neubofy?',
						'acceptedAnswer': {
							'@type': 'Answer',
							'text': 'You can consult across Neubofy\'s 5 capability pillars: (1) Decide — technology strategy, build vs buy, system architecture; (2) Implement — custom software, SaaS configuration, integrations, AI workflows; (3) Improve — legacy modernization, DevOps, performance tuning; (4) Protect & Verify — cybersecurity, code audits, QA; and (5) Operate — continuous maintenance and support.'
						}
					},
					{
						'@type': 'Question',
						'name': 'How does Neubofy\'s 9-step orchestration model work?',
						'acceptedAnswer': {
							'@type': 'Answer',
							'text': 'The 9-step orchestration model consists of: Understand, Evaluate, Decide, Architect, Assemble, Execute, Verify, Deliver, and Support/Evolve. We do not start with preconceived technology; we evaluate the business requirement first, select the right capabilities, and guarantee independent verification.'
						}
					},
					{
						'@type': 'Question',
						'name': 'How does Neubofy guarantee independent verification?',
						'acceptedAnswer': {
							'@type': 'Answer',
							'text': 'At Neubofy, the person executing or building the code is never the only person who decides it is ready for production. All delivered work undergoes an objective review against agreed architectural specifications, security criteria, and performance benchmarks prior to delivery.'
						}
					},
					{
						'@type': 'Question',
						'name': 'Is the initial consultation free?',
						'acceptedAnswer': {
							'@type': 'Answer',
							'text': 'Yes, Neubofy offers initial strategy consultations free of charge to understand your business objectives, review current systems, and determine whether configuration, integration, custom build, or an audit is the right approach.'
						}
					},
					{
						'@type': 'Question',
						'name': 'How do I prepare for my consultation session?',
						'acceptedAnswer': {
							'@type': 'Answer',
							'text': 'You do not need a finished technical specification. Simply bring your business goals, current bottlenecks, or details of existing tools you are using. Neubofy will guide the discussion to identify the most cost-effective and scalable technology approach.'
						}
					}
				]
			}
		]
	})}</script>`}
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
										{eventType.experts ? eventType.experts.length : 0} specialist(s)
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

			<!-- AEO & Search Engine FAQ Accordion Section -->
			<section class="mt-24 max-w-4xl mx-auto border-t border-white/10 pt-16 animate-fade-in" aria-labelledby="faq-heading">
				<div class="text-center mb-12">
					<span class="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 inline-block mb-3">
						Clarity & Expectations
					</span>
					<h2 id="faq-heading" class="text-2xl sm:text-4xl font-bold text-white tracking-tight mb-3">
						Frequently Asked Questions
					</h2>
					<p class="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto">
						Everything you need to know about Neubofy's technology department model, consultation process, and independent verification.
					</p>
				</div>

				<div class="space-y-4">
					<!-- FAQ Item 1 -->
					<div class="glass-card rounded-2xl border border-white/10 overflow-hidden transition-colors">
						<button
							type="button"
							class="w-full px-6 py-5 text-left flex items-center justify-between gap-4 text-white font-medium text-base sm:text-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
							onclick={() => toggleFaq(0)}
							aria-expanded={openFaqIndex === 0}
						>
							<span>What is Neubofy and how does an external technology department work?</span>
							<span class="text-zinc-400 text-xl shrink-0 transition-transform {openFaqIndex === 0 ? 'rotate-45' : ''}">+</span>
						</button>
						{#if openFaqIndex === 0}
							<div class="px-6 pb-5 text-sm sm:text-base text-zinc-400 leading-relaxed border-t border-white/5 pt-4 animate-fade-in">
								Neubofy functions as your complete external technology department. Instead of hiring an expensive full-time engineering executive or managing multiple freelancers yourself, Neubofy translates your core business problem into precise technical requirements, coordinates vetted independent specialists, and independently verifies the delivered software before handover.
							</div>
						{/if}
					</div>

					<!-- FAQ Item 2 -->
					<div class="glass-card rounded-2xl border border-white/10 overflow-hidden transition-colors">
						<button
							type="button"
							class="w-full px-6 py-5 text-left flex items-center justify-between gap-4 text-white font-medium text-base sm:text-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
							onclick={() => toggleFaq(1)}
							aria-expanded={openFaqIndex === 1}
						>
							<span>What technology domains do Neubofy consultations cover?</span>
							<span class="text-zinc-400 text-xl shrink-0 transition-transform {openFaqIndex === 1 ? 'rotate-45' : ''}">+</span>
						</button>
						{#if openFaqIndex === 1}
							<div class="px-6 pb-5 text-sm sm:text-base text-zinc-400 leading-relaxed border-t border-white/5 pt-4 animate-fade-in">
								Our consultations span Neubofy's 5 capability pillars:
								<ul class="list-disc pl-5 mt-2 space-y-1.5 text-zinc-300">
									<li><strong class="text-white">DECIDE:</strong> Technology strategy, build vs. buy analysis, software architecture.</li>
									<li><strong class="text-white">IMPLEMENT:</strong> Custom software development, SaaS configuration, API integrations, and AI workflow automation.</li>
									<li><strong class="text-white">IMPROVE:</strong> Legacy system modernization, cloud DevOps, database performance tuning.</li>
									<li><strong class="text-white">PROTECT & VERIFY:</strong> Cybersecurity reviews, code quality audits, QA, and architecture verification.</li>
									<li><strong class="text-white">OPERATE:</strong> Ongoing maintenance, SLA uptime support, and continuous systems evolution.</li>
								</ul>
							</div>
						{/if}
					</div>

					<!-- FAQ Item 3 -->
					<div class="glass-card rounded-2xl border border-white/10 overflow-hidden transition-colors">
						<button
							type="button"
							class="w-full px-6 py-5 text-left flex items-center justify-between gap-4 text-white font-medium text-base sm:text-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
							onclick={() => toggleFaq(2)}
							aria-expanded={openFaqIndex === 2}
						>
							<span>What is the 9-step orchestration workflow?</span>
							<span class="text-zinc-400 text-xl shrink-0 transition-transform {openFaqIndex === 2 ? 'rotate-45' : ''}">+</span>
						</button>
						{#if openFaqIndex === 2}
							<div class="px-6 pb-5 text-sm sm:text-base text-zinc-400 leading-relaxed border-t border-white/5 pt-4 animate-fade-in">
								We believe building software is not the same as solving a business problem. Our 9-step orchestration workflow ensures optimal outcomes: (1) Understand, (2) Evaluate, (3) Decide, (4) Architect, (5) Assemble specialists, (6) Execute, (7) Independently Verify, (8) Deliver, and (9) Support & Evolve. We never start with predetermined technology—we start with your business problem.
							</div>
						{/if}
					</div>

					<!-- FAQ Item 4 -->
					<div class="glass-card rounded-2xl border border-white/10 overflow-hidden transition-colors">
						<button
							type="button"
							class="w-full px-6 py-5 text-left flex items-center justify-between gap-4 text-white font-medium text-base sm:text-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
							onclick={() => toggleFaq(3)}
							aria-expanded={openFaqIndex === 3}
						>
							<span>How does Neubofy's independent verification protect my business?</span>
							<span class="text-zinc-400 text-xl shrink-0 transition-transform {openFaqIndex === 3 ? 'rotate-45' : ''}">+</span>
						</button>
						{#if openFaqIndex === 3}
							<div class="px-6 pb-5 text-sm sm:text-base text-zinc-400 leading-relaxed border-t border-white/5 pt-4 animate-fade-in">
								At Neubofy, the specialist or developer who writes the code is never the only person who decides it is ready for production. Every deliverable is independently audited by Neubofy analysts against agreed functional requirements, security best practices, and performance standards before delivery.
							</div>
						{/if}
					</div>

					<!-- FAQ Item 5 -->
					<div class="glass-card rounded-2xl border border-white/10 overflow-hidden transition-colors">
						<button
							type="button"
							class="w-full px-6 py-5 text-left flex items-center justify-between gap-4 text-white font-medium text-base sm:text-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
							onclick={() => toggleFaq(4)}
							aria-expanded={openFaqIndex === 4}
						>
							<span>Is the initial strategy consultation free?</span>
							<span class="text-zinc-400 text-xl shrink-0 transition-transform {openFaqIndex === 4 ? 'rotate-45' : ''}">+</span>
						</button>
						{#if openFaqIndex === 4}
							<div class="px-6 pb-5 text-sm sm:text-base text-zinc-400 leading-relaxed border-t border-white/5 pt-4 animate-fade-in">
								Yes, all initial strategy consultations are currently 100% complimentary. We examine your current tech stack, operational pain points, and strategic goals to provide you with actionable recommendations on the most efficient technical path.
							</div>
						{/if}
					</div>

					<!-- FAQ Item 6 -->
					<div class="glass-card rounded-2xl border border-white/10 overflow-hidden transition-colors">
						<button
							type="button"
							class="w-full px-6 py-5 text-left flex items-center justify-between gap-4 text-white font-medium text-base sm:text-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
							onclick={() => toggleFaq(5)}
							aria-expanded={openFaqIndex === 5}
						>
							<span>What do I need to prepare before my consultation?</span>
							<span class="text-zinc-400 text-xl shrink-0 transition-transform {openFaqIndex === 5 ? 'rotate-45' : ''}">+</span>
						</button>
						{#if openFaqIndex === 5}
							<div class="px-6 pb-5 text-sm sm:text-base text-zinc-400 leading-relaxed border-t border-white/5 pt-4 animate-fade-in">
								You do not need a completed technical specification. Simply bring your business goals, a summary of your current workflow or bottlenecks, and any existing systems you use. Neubofy translates your requirements into clear technical architecture during the session.
							</div>
						{/if}
					</div>
				</div>

				<!-- Official Portals Quick Links -->
				<div class="mt-12 p-6 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
					<div>
						<h4 class="text-sm font-semibold text-white">Have an immediate project scope ready?</h4>
						<p class="text-xs text-zinc-400 mt-0.5">Submit project requirements directly or contact our enterprise desk.</p>
					</div>
					<div class="flex flex-wrap items-center justify-center gap-3">
						<a
							href="https://neubofy.in/order"
							target="_blank"
							rel="noopener noreferrer"
							class="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/10 transition-colors"
						>
							Start a Project ↗
						</a>
						<a
							href="https://neubofy.zohodesk.in/portal"
							target="_blank"
							rel="noopener noreferrer"
							class="px-4 py-2 rounded-lg bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white text-xs font-semibold border border-white/10 transition-colors"
						>
							Help Centre ↗
						</a>
					</div>
				</div>
			</section>
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
					{#if selectedEvent.experts && selectedEvent.experts.length > 0}
						{#each selectedEvent.experts as expert}
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
											{#each expert.session_pricing && expert.session_pricing.length > 0 ? expert.session_pricing : (selectedEvent.durations || [30]).map((d: any) => ({ duration: d, price: 0 })) as tier}
												<button
													type="button"
													onclick={() => handleSelectExpert(expert, tier.duration)}
													class="px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all text-left flex flex-col {selectedExpert?.id === expert.id && selectedDuration === tier.duration
														? 'bg-blue-600/30 border-blue-500 text-white shadow-[0_0_16px_rgba(59,130,246,0.3)]'
														: 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'}"
												>
													<span class="font-bold">{tier.duration} Mins</span>
													<span class="text-[11px] text-blue-400 font-bold">₹{tier.price || 0}</span>
													<span class="text-[9px] text-emerald-400 font-medium">100% waiver with VIP coupon</span>
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
					{:else}
						<div class="glass-card rounded-2xl p-10 text-center border border-white/10 max-w-lg mx-auto space-y-4 animate-fade-in">
							<div class="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl">
								👥
							</div>
							<h4 class="text-lg font-bold text-white">No Specialists Assigned Yet</h4>
							<p class="text-xs sm:text-sm text-zinc-400 leading-relaxed">
								There are currently no specialists assigned to <strong>{selectedEvent.name}</strong>. Please choose another consultation service or contact our team.
							</p>
							<div class="pt-2">
								<button
									type="button"
									onclick={() => (step = 1)}
									class="btn-electric px-6 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2"
								>
									← Browse Other Services
								</button>
							</div>
						</div>
					{/if}
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

				<!-- Intake & Client Account Form -->
				<div class="glass-card rounded-2xl p-6 sm:p-8 border border-white/10 space-y-6">
					<div>
						<h3 class="text-lg font-bold text-white">Client Account & Details</h3>
						<p class="text-xs text-zinc-400">All bookings are linked to your verified client portal account.</p>
					</div>

					<!-- Firebase Client Auth Section -->
					{#if !$clientUser}
						<div class="p-5 rounded-2xl bg-black/40 border border-blue-500/30 space-y-4">
							<div class="flex items-center gap-3">
								<span class="text-xl">🔐</span>
								<div>
									<h4 class="text-sm font-bold text-white">Sign In or Create Client Account</h4>
									<p class="text-[11px] text-zinc-400">An authenticated account is required to book and manage sessions.</p>
								</div>
							</div>

							<!-- One-Click Google Auth -->
							<button
								type="button"
								onclick={async () => {
									authError = '';
									authSubmitting = true;
									try {
										await signInWithGoogle();
									} catch (err: any) {
										authError = err.message || 'Google sign-in failed.';
									} finally {
										authSubmitting = false;
									}
								}}
								disabled={authSubmitting}
								class="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-white text-zinc-900 font-bold text-xs hover:bg-zinc-100 transition-all shadow-md disabled:opacity-50"
							>
								<svg class="w-4 h-4" viewBox="0 0 24 24">
									<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
									<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
									<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
									<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
								</svg>
								<span>Continue with Google</span>
							</button>

							<div class="flex items-center gap-3">
								<div class="flex-1 h-px bg-white/10"></div>
								<span class="text-[10px] uppercase font-mono text-zinc-500">or with email</span>
								<div class="flex-1 h-px bg-white/10"></div>
							</div>

							<!-- Email Auth Form -->
							<div class="grid grid-cols-2 p-1 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold">
								<button
									type="button"
									onclick={() => { authMode = 'login'; authError = ''; }}
									class="py-1 rounded-lg transition-all {authMode === 'login' ? 'bg-blue-600 text-white' : 'text-zinc-400'}"
								>
									Sign In
								</button>
								<button
									type="button"
									onclick={() => { authMode = 'signup'; authError = ''; }}
									class="py-1 rounded-lg transition-all {authMode === 'signup' ? 'bg-blue-600 text-white' : 'text-zinc-400'}"
								>
									Register
								</button>
							</div>

							<div class="space-y-2.5">
								{#if authMode === 'signup'}
									<input
										type="text"
										bind:value={authName}
										placeholder="Your Full Name"
										class="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-zinc-500 outline-none focus:border-blue-500"
									/>
								{/if}
								<input
									type="email"
									bind:value={authEmail}
									placeholder="Email Address"
									class="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-zinc-500 outline-none focus:border-blue-500"
								/>
								<input
									type="password"
									bind:value={authPassword}
									placeholder="Password (min 6 characters)"
									class="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-zinc-500 outline-none focus:border-blue-500"
								/>

								{#if authError}
									<p class="text-xs text-red-400">{authError}</p>
								{/if}

								<button
									type="button"
									disabled={authSubmitting || !authEmail || !authPassword}
									onclick={async () => {
										authError = '';
										authSubmitting = true;
										try {
											if (authMode === 'login') {
												await signInWithEmail(authEmail.trim(), authPassword);
											} else {
												await signUpWithEmail(authEmail.trim(), authPassword, authName.trim());
											}
										} catch (err: any) {
											authError = err.message || 'Authentication failed.';
										} finally {
											authSubmitting = false;
										}
									}}
									class="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors disabled:opacity-50"
								>
									{authSubmitting ? 'Authenticating...' : authMode === 'login' ? 'Sign In to Account' : 'Create & Link Account'}
								</button>
							</div>
						</div>
					{:else}
						<!-- Signed In Client Badge -->
						<div class="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-between">
							<div class="flex items-center gap-3">
								<div class="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
									{($clientUser.displayName || $clientUser.email || 'U').charAt(0).toUpperCase()}
								</div>
								<div>
									<div class="text-xs font-bold text-white flex items-center gap-2">
										<span>{$clientUser.displayName || 'Verified Client'}</span>
										<span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Firebase Auth ✓</span>
									</div>
									<div class="text-[11px] text-zinc-400 font-mono">{$clientUser.email}</div>
								</div>
							</div>
							<button
								type="button"
								onclick={signOutClient}
								class="text-[11px] text-zinc-400 hover:text-white px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
							>
								Switch Account
							</button>
						</div>
					{/if}

					{#if $clientUser}
						<!-- Verified Participant Information -->
						<div class="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
							<div class="flex items-center justify-between text-xs">
								<span class="text-zinc-400">Consultation For:</span>
								<span class="font-bold text-white">{$clientUser.displayName || $clientUser.email}</span>
							</div>
							<div class="flex items-center justify-between text-xs">
								<span class="text-zinc-400">Calendar & Meeting Invite:</span>
								<span class="font-mono text-zinc-300">{$clientUser.email}</span>
							</div>
							{#if $clientUser.phoneNumber}
								<div class="flex items-center justify-between text-xs">
									<span class="text-zinc-400">Linked Phone:</span>
									<span class="font-mono text-zinc-300">{$clientUser.phoneNumber}</span>
								</div>
							{/if}
						</div>

						<!-- Single Optional Notes field -->
						<div>
							<label for="attendee-notes" class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
								Project Context / Session Agenda (Optional)
							</label>
							<textarea
								id="attendee-notes"
								bind:value={attendeeNotes}
								rows={2}
								placeholder="Share any background, architecture questions, or links for your consultant..."
								class="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs outline-none focus:border-blue-500 resize-none"
							></textarea>
						</div>
					{/if}

					<!-- Pricing Breakdown & Coupon Waiver -->
					<div class="p-5 rounded-2xl bg-black/40 border border-white/10 space-y-4">
						<div class="flex items-center justify-between">
							<div>
								<span class="text-[10px] font-bold uppercase tracking-wider text-blue-400">Checkout & Fee</span>
								<h4 class="text-sm font-bold text-white">Consultation Fee & Waiver</h4>
							</div>
							<span class="text-xs font-mono font-bold text-zinc-300">
								{selectedDuration} Mins with {selectedExpert?.name || 'Expert'}
							</span>
						</div>

						<!-- Quick One-Click 100% OFF Coupon -->
						<div class="p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
							<div class="flex items-center gap-2">
								<span class="text-lg">🎁</span>
								<div>
									<div class="text-xs font-bold text-emerald-400">100% OFF Welcome Promo Available</div>
									<div class="text-[10px] text-zinc-400">Use code <span class="font-mono font-bold text-white">NEUBOFYVIP</span> to make your consultation 100% free.</div>
								</div>
							</div>
							<button
								type="button"
								onclick={() => applyCoupon('NEUBOFYVIP')}
								disabled={couponValidating || appliedCoupon?.code === 'NEUBOFYVIP'}
								class="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm shrink-0 disabled:opacity-60"
							>
								{appliedCoupon?.code === 'NEUBOFYVIP' ? '✓ Applied' : 'Apply NEUBOFYVIP'}
							</button>
						</div>

						<!-- Coupon Input Box -->
						<div class="flex gap-2">
							<input
								type="text"
								bind:value={couponInput}
								placeholder="Enter promo or waiver code"
								class="flex-1 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white uppercase font-mono placeholder-zinc-500 outline-none focus:border-blue-500"
							/>
							<button
								type="button"
								disabled={couponValidating || !couponInput.trim()}
								onclick={() => applyCoupon()}
								class="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-colors disabled:opacity-50"
							>
								{couponValidating ? 'Checking...' : 'Apply Code'}
							</button>
							{#if appliedCoupon}
								<button
									type="button"
									onclick={removeCoupon}
									class="px-3 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-red-400 bg-white/5 transition-colors"
								>
									✕
								</button>
							{/if}
						</div>

						{#if couponError}
							<p class="text-xs text-red-400">{couponError}</p>
						{/if}

						{#if appliedCoupon}
							<div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-medium">
								{appliedCoupon.message}
							</div>
						{/if}

						<!-- Price Calculation Summary -->
						<div class="pt-3 border-t border-white/10 space-y-1.5 text-xs font-mono">
							<div class="flex items-center justify-between text-zinc-400">
								<span>Consultation Rate:</span>
								<span>₹{currentBasePrice}</span>
							</div>
							{#if appliedCoupon}
								<div class="flex items-center justify-between text-emerald-400">
									<span>Promo Discount ({appliedCoupon.code}):</span>
									<span>-₹{appliedCoupon.discountAmount}</span>
								</div>
							{/if}
							<div class="flex items-center justify-between text-sm font-bold pt-2 border-t border-white/5 text-white">
								<span>Final Amount:</span>
								<span class={currentFinalPrice === 0 ? 'text-emerald-400' : 'text-blue-400'}>
									₹{currentFinalPrice} {currentFinalPrice === 0 ? '(100% Free / Auto-completed)' : ''}
								</span>
							</div>
						</div>
					</div>

					{#if bookingError}
						<div class="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-medium">
							{bookingError}
						</div>
					{/if}

					<!-- Submit Button -->
					<div class="pt-4 border-t border-white/10">
						<button
							type="button"
							disabled={submittingBooking || !$clientUser}
							onclick={handleConfirmBooking}
							class="w-full btn-electric py-3.5 px-6 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
						>
							{#if submittingBooking}
								<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
								<span>Confirming Consultation...</span>
							{:else}
								<span>Confirm & Schedule Consultation {currentFinalPrice === 0 ? '(Free)' : `(₹${currentFinalPrice})`} →</span>
							{/if}
						</button>

						{#if !$clientUser}
							<p class="text-[11px] text-amber-400/90 text-center mt-2 font-medium">
								* Please sign in or register above to complete your booking.
							</p>
						{:else if currentFinalPrice > 0}
							<p class="text-[11px] text-zinc-400 text-center mt-2">
								* Payment gateway is currently invite-only. Apply coupon <button type="button" onclick={() => applyCoupon('NEUBOFYVIP')} class="text-blue-400 underline font-bold">NEUBOFYVIP</button> to proceed without charge.
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
