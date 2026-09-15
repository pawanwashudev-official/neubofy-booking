<script lang="ts">
	import CountryCodeSelector from '$lib/components/booking/CountryCodeSelector.svelte';
	import { type CountryInfo } from '$lib/constants/countries';
	import {
		clientUser,
		clientAuthLoading,
		signInWithGoogle,
		signInWithEmail,
		signUpWithEmail,
		signOutClient
	} from '$lib/firebase/client';

	interface Props {
		bookingForm: {
			name: string;
			email: string;
			phone: string;
			countryCode: string;
			notes: string;
			couponCode: string;
		};
		eventSlug: string;
		expertUserId?: string;
		durationMinutes?: number;
		sessionPricing?: Array<{ duration: number; price: number; label?: string }>;
		basePriceInr?: number;
		bookingStatus: 'idle' | 'submitting' | 'success' | 'error';
		bookingError: string;
		brandColor: string;
		brandDark: string;
		onSubmit: (e: Event) => void;
	}

	let {
		bookingForm = $bindable(),
		eventSlug,
		expertUserId = '',
		durationMinutes = 30,
		sessionPricing = [],
		basePriceInr = 0,
		bookingStatus,
		bookingError,
		brandColor,
		brandDark,
		onSubmit
	}: Props = $props();

	// Auto-calculate base fee from expert session pricing or fallback event fee
	const activeBasePrice = $derived.by(() => {
		if (sessionPricing && sessionPricing.length > 0) {
			const matchingTier = sessionPricing.find((t) => t.duration === durationMinutes);
			if (matchingTier) return matchingTier.price;
			return sessionPricing[0].price;
		}
		return basePriceInr || 0;
	});

	let showCountryModal = $state(false);
	let selectedCountryFlag = $state('🇮🇳');
	let couponValidating = $state(false);
	let couponMessage = $state('');
	let couponError = $state('');
	let discountAmount = $state(0);
	let finalPrice = $state(0);
	let isComplimentary = $state(false);

	// Client Auth Modal / Inline State
	let authMode = $state<'login' | 'signup'>('login');
	let authEmail = $state('');
	let authPassword = $state('');
	let authName = $state('');
	let authError = $state('');
	let authSubmitting = $state(false);

	// Initialize price & sync with activeBasePrice
	$effect(() => {
		if (discountAmount === 0) {
			finalPrice = activeBasePrice;
			isComplimentary = activeBasePrice === 0;
		} else {
			finalPrice = Math.max(0, activeBasePrice - discountAmount);
			isComplimentary = finalPrice === 0;
		}
	});

	// Auto-fill form details when clientUser logs in
	$effect(() => {
		if ($clientUser) {
			if (!bookingForm.name && $clientUser.displayName) {
				bookingForm.name = $clientUser.displayName;
			}
			if (!bookingForm.email && $clientUser.email) {
				bookingForm.email = $clientUser.email;
			}
		}
	});

	function handleCountrySelect(country: CountryInfo) {
		bookingForm.countryCode = country.dialCode;
		selectedCountryFlag = country.flag;
	}

	async function handleApplyCoupon(forcedCode?: string) {
		const codeToValidate = (forcedCode || bookingForm.couponCode || '').trim();
		if (!codeToValidate) {
			couponError = 'Please enter a coupon code.';
			return;
		}

		bookingForm.couponCode = codeToValidate;
		couponValidating = true;
		couponMessage = '';
		couponError = '';

		try {
			const res = await fetch('/api/coupons/validate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					code: codeToValidate,
					eventSlug,
					expertUserId,
					durationMinutes
				})
			});

			const json = (await res.json()) as any;
			if (!res.ok) {
				throw new Error(json.message || 'Invalid or expired coupon code.');
			}

			couponMessage = json.message || 'Coupon applied successfully!';
			discountAmount = json.discountAmount || 0;
			finalPrice = json.finalPrice ?? 0;
			isComplimentary = json.isComplimentary || finalPrice === 0;
		} catch (err: any) {
			couponError = err.message || 'Coupon verification failed.';
			discountAmount = 0;
			finalPrice = activeBasePrice;
			isComplimentary = activeBasePrice === 0;
		} finally {
			couponValidating = false;
		}
	}
</script>

<div class="max-w-md w-full space-y-6">
	<div>
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-bold text-white tracking-tight">Consultation Details</h2>
			{#if isComplimentary}
				<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
					🎁 100% Free / Waived
				</span>
			{:else}
				<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-blue-500/15 text-blue-400 border border-blue-500/30">
					₹{finalPrice}
				</span>
			{/if}
		</div>
		<p class="text-xs text-zinc-400 mt-1">
			Link your verified client account to confirm your strategy consultation session.
		</p>
	</div>

	{#if bookingError}
		<div class="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold">
			✕ {bookingError}
		</div>
	{/if}

	<!-- ========================================== -->
	<!-- FIREBASE AUTHENTICATION VERIFICATION CARD -->
	<!-- ========================================== -->
	{#if !$clientUser}
		<div class="p-4 rounded-2xl bg-black/40 border border-blue-500/30 space-y-3.5">
			<div class="flex items-center gap-2.5">
				<span class="text-lg">🔐</span>
				<div>
					<h3 class="text-xs font-bold text-white">Client Account Verification</h3>
					<p class="text-[10px] text-zinc-400">Sign in to link and secure this consultation session</p>
				</div>
			</div>

			<!-- One-Click Google Sign In -->
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
				class="w-full flex items-center justify-center gap-2.5 py-2 px-3 rounded-xl bg-white text-zinc-900 font-bold text-xs hover:bg-zinc-100 transition-all shadow-md disabled:opacity-50"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24">
					<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
					<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
					<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
					<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
				</svg>
				<span>Continue with Google</span>
			</button>

			<div class="flex items-center gap-2">
				<div class="flex-1 h-px bg-white/10"></div>
				<span class="text-[9px] uppercase font-mono text-zinc-500">or email</span>
				<div class="flex-1 h-px bg-white/10"></div>
			</div>

			<!-- Email Sign In / Up Tab Switcher -->
			<div class="grid grid-cols-2 p-0.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-semibold">
				<button
					type="button"
					onclick={() => { authMode = 'login'; authError = ''; }}
					class="py-1 rounded-md transition-all {authMode === 'login' ? 'bg-blue-600 text-white' : 'text-zinc-400'}"
				>
					Sign In
				</button>
				<button
					type="button"
					onclick={() => { authMode = 'signup'; authError = ''; }}
					class="py-1 rounded-md transition-all {authMode === 'signup' ? 'bg-blue-600 text-white' : 'text-zinc-400'}"
				>
					Register
				</button>
			</div>

			<div class="space-y-2">
				{#if authMode === 'signup'}
					<input
						type="text"
						bind:value={authName}
						placeholder="Your Full Name"
						class="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-zinc-500 outline-none focus:border-blue-500"
					/>
				{/if}
				<input
					type="email"
					bind:value={authEmail}
					placeholder="Email address"
					class="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-zinc-500 outline-none focus:border-blue-500"
				/>
				<input
					type="password"
					bind:value={authPassword}
					placeholder="Password (min 6 characters)"
					class="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-zinc-500 outline-none focus:border-blue-500"
				/>

				{#if authError}
					<p class="text-[11px] text-red-400">{authError}</p>
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
					class="w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors disabled:opacity-50"
				>
					{authSubmitting ? 'Verifying...' : authMode === 'login' ? 'Sign In' : 'Create & Link Account'}
				</button>
			</div>
		</div>
	{:else}
		<!-- Authenticated Client Badge -->
		<div class="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-between">
			<div class="flex items-center gap-2.5">
				<div class="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-md">
					{($clientUser.displayName || $clientUser.email || 'C').charAt(0).toUpperCase()}
				</div>
				<div class="min-w-0">
					<div class="text-xs font-bold text-white flex items-center gap-1.5 truncate">
						<span class="truncate">{$clientUser.displayName || 'Client'}</span>
						<span class="text-[9px] font-mono px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">Verified ✓</span>
					</div>
					<div class="text-[10px] text-zinc-400 font-mono truncate">{$clientUser.email}</div>
				</div>
			</div>
			<button
				type="button"
				onclick={signOutClient}
				class="text-[10px] text-zinc-400 hover:text-white px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors shrink-0"
			>
				Sign Out
			</button>
		</div>
	{/if}

	<form onsubmit={onSubmit} class="space-y-4">
		{#if $clientUser}
			<!-- Session & Participant Confirmation -->
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
						<span class="text-zinc-400">Linked Mobile:</span>
						<span class="font-mono text-zinc-300">{$clientUser.phoneNumber}</span>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Coupon Code Input with 100% OFF VIP Waiver Fast-Track -->
		<div class="pt-1">
			<div class="flex items-center justify-between mb-1.5">
				<label for="coupon" class="block text-xs font-bold uppercase tracking-wider text-zinc-300">
					Coupon or Referral Code
				</label>
				<button
					type="button"
					onclick={() => handleApplyCoupon('NEUBOFYVIP')}
					class="text-[10px] font-bold text-blue-400 hover:text-blue-300 underline"
				>
					Apply 100% OFF VIP Waiver
				</button>
			</div>
			<div class="flex gap-2">
				<input
					type="text"
					id="coupon"
					bind:value={bookingForm.couponCode}
					placeholder="e.g. NEUBOFYVIP"
					class="flex-1 px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-xs font-mono uppercase text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all"
				/>
				<button
					type="button"
					onclick={() => handleApplyCoupon()}
					disabled={couponValidating || !bookingForm.couponCode?.trim()}
					class="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white border border-white/10 disabled:opacity-40 transition-all"
				>
					{couponValidating ? 'Checking...' : 'Apply'}
				</button>
			</div>
			{#if couponMessage}
				<p class="text-xs text-emerald-400 mt-1.5 font-medium flex items-center gap-1">
					✓ {couponMessage}
				</p>
			{/if}
			{#if couponError}
				<p class="text-xs text-red-400 mt-1.5 font-medium flex items-center gap-1">
					✕ {couponError}
				</p>
			{/if}
		</div>

		<!-- Notes / Agenda -->
		<div>
			<label for="notes" class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
				Session Agenda / Requirements (Optional)
			</label>
			<textarea
				id="notes"
				bind:value={bookingForm.notes}
				rows="3"
				placeholder="Describe your project, technology stack, or specific questions..."
				class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all resize-none"
			></textarea>
		</div>

		<!-- Pricing Summary Banner if Paid -->
		{#if !isComplimentary}
			<div class="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-zinc-300 flex items-center justify-between">
				<span>Consultation Payable Fee:</span>
				<div class="text-right">
					{#if discountAmount > 0}
						<span class="line-through text-zinc-500 mr-1.5">₹{activeBasePrice}</span>
					{/if}
					<span class="font-bold text-white text-sm font-mono">₹{finalPrice}</span>
				</div>
			</div>
		{/if}

		<button
			type="submit"
			disabled={bookingStatus === 'submitting' || !$clientUser}
			class="w-full btn-electric py-3 px-6 rounded-xl font-bold text-xs sm:text-sm shadow-[0_0_24px_rgba(59,130,246,0.4)] transition disabled:opacity-50 disabled:cursor-not-allowed"
		>
			{#if bookingStatus === 'submitting'}
				Scheduling Meeting...
			{:else if !$clientUser}
				Please Sign In to Complete Booking 🔐
			{:else}
				Confirm & Schedule Consultation →
			{/if}
		</button>
	</form>
</div>

<!-- Country Code Picker Modal -->
{#if showCountryModal}
	<CountryCodeSelector
		selectedDialCode={bookingForm.countryCode || '+91'}
		onSelect={handleCountrySelect}
		onClose={() => (showCountryModal = false)}
	/>
{/if}
