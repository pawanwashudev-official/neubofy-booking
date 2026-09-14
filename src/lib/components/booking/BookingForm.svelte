<script lang="ts">
	import CountryCodeSelector from '$lib/components/booking/CountryCodeSelector.svelte';
	import { type CountryInfo } from '$lib/constants/countries';

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
		isFreeOnly?: boolean;
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
		isFreeOnly = true,
		basePriceInr = 0,
		bookingStatus,
		bookingError,
		brandColor,
		brandDark,
		onSubmit
	}: Props = $props();

	let showCountryModal = $state(false);
	let selectedCountryFlag = $state('🇮🇳');
	let couponValidating = $state(false);
	let couponMessage = $state('');
	let couponError = $state('');
	let discountAmount = $state(0);
	let finalPrice = $state(isFreeOnly ? 0 : basePriceInr);
	let isComplimentary = $state(isFreeOnly || basePriceInr === 0);

	function handleCountrySelect(country: CountryInfo) {
		bookingForm.countryCode = country.dialCode;
		selectedCountryFlag = country.flag;
	}

	async function handleApplyCoupon() {
		if (!bookingForm.couponCode?.trim()) {
			couponError = 'Please enter a coupon code.';
			return;
		}

		couponValidating = true;
		couponMessage = '';
		couponError = '';

		try {
			const res = await fetch('/api/coupons/validate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					code: bookingForm.couponCode.trim(),
					eventSlug
				})
			});

			const json = (await res.json()) as any;
			if (!res.ok) {
				throw new Error(json.message || 'Invalid coupon code.');
			}

			couponMessage = json.message;
			discountAmount = json.discountAmount || 0;
			finalPrice = json.finalPrice || 0;
			isComplimentary = json.isComplimentary;
		} catch (err: any) {
			couponError = err.message || 'Coupon verification failed.';
			discountAmount = 0;
			finalPrice = isFreeOnly ? 0 : basePriceInr;
			isComplimentary = isFreeOnly || basePriceInr === 0;
		} finally {
			couponValidating = false;
		}
	}
</script>

<div class="max-w-md space-y-6">
	<div>
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-bold text-white tracking-tight">Enter Consultation Details</h2>
			{#if isComplimentary}
				<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
					🎁 Complimentary
				</span>
			{:else}
				<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-blue-500/15 text-blue-400 border border-blue-500/30">
					₹{finalPrice}
				</span>
			{/if}
		</div>
		<p class="text-xs text-zinc-400 mt-1">
			Provide your contact information so your expert consultant can prepare for the session.
		</p>
	</div>

	{#if bookingError}
		<div class="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold">
			✕ {bookingError}
		</div>
	{/if}

	<form onsubmit={onSubmit} class="space-y-4">
		<!-- Full Name -->
		<div>
			<label for="name" class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
				Full Name *
			</label>
			<input
				type="text"
				id="name"
				bind:value={bookingForm.name}
				required
				placeholder="Your Name"
				class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all"
			/>
		</div>

		<!-- Email Address -->
		<div>
			<label for="email" class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
				Email Address *
			</label>
			<input
				type="email"
				id="email"
				bind:value={bookingForm.email}
				required
				placeholder="you@company.com"
				class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all"
			/>
		</div>

		<!-- Phone Number with Country Code Dropdown -->
		<div>
			<label for="phone" class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
				Mobile / WhatsApp (Optional)
			</label>
			<div class="flex rounded-xl bg-white/5 border border-white/15 overflow-hidden focus-within:border-blue-500 transition-all">
				<button
					type="button"
					onclick={() => (showCountryModal = true)}
					class="px-3 py-2.5 bg-white/[0.04] hover:bg-white/10 border-r border-white/10 flex items-center gap-1.5 text-xs text-zinc-200 transition-colors shrink-0"
					title="Change country code"
				>
					<span class="text-sm">{selectedCountryFlag}</span>
					<span class="font-mono text-xs">{bookingForm.countryCode || '+91'}</span>
					<span class="text-[10px] text-zinc-500">▾</span>
				</button>
				<input
					type="tel"
					id="phone"
					bind:value={bookingForm.phone}
					placeholder="98765 43210"
					class="flex-1 px-3 py-2.5 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
				/>
			</div>
			<p class="text-[10px] text-zinc-500 mt-1">Used for meeting reminders and urgent schedule adjustments.</p>
		</div>

		<!-- Coupon Code Input (Always accessible for client discount codes or VIP complimentary access) -->
		<div class="pt-1">
			<label for="coupon" class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
				Have a Coupon or Referral Code?
			</label>
			<div class="flex gap-2">
				<input
					type="text"
					id="coupon"
					bind:value={bookingForm.couponCode}
					placeholder="e.g. VIP100, FOUNDER"
					class="flex-1 px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-xs font-mono uppercase text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all"
				/>
				<button
					type="button"
					onclick={handleApplyCoupon}
					disabled={couponValidating || !bookingForm.couponCode?.trim()}
					class="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white border border-white/10 disabled:opacity-40 transition-all"
				>
					{couponValidating ? 'Checking...' : 'Apply'}
				</button>
			</div>
			{#if couponMessage}
				<p class="text-xs text-emerald-400 mt-1.5 font-medium flex items-center gap-1">
					{couponMessage}
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
						<span class="line-through text-zinc-500 mr-1.5">₹{basePriceInr}</span>
					{/if}
					<span class="font-bold text-white text-sm font-mono">₹{finalPrice}</span>
				</div>
			</div>
		{/if}

		<button
			type="submit"
			disabled={bookingStatus === 'submitting'}
			class="w-full btn-electric py-3 px-6 rounded-xl font-bold text-xs sm:text-sm shadow-[0_0_24px_rgba(59,130,246,0.4)] transition disabled:opacity-50"
		>
			{bookingStatus === 'submitting' ? 'Scheduling Meeting...' : 'Confirm & Schedule Consultation →'}
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
