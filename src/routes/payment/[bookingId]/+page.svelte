<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import type { PageData, ActionData } from './$types';
	import Footer from '$lib/components/Footer.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let confirming = $state(false);
	let copied = $state(false);
	const isSuccess = $derived(data.alreadyPaid || $page.url.searchParams.get('success') === 'true');

	function formatDateTime(dateStr: string) {
		const date = new Date(dateStr);
		return new Intl.DateTimeFormat('en-IN', {
			weekday: 'long',
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		}).format(date);
	}

	async function copyUpiId() {
		try {
			await navigator.clipboard.writeText(data.upiId);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2500);
		} catch (err) {
			console.error('Failed to copy UPI ID:', err);
		}
	}
</script>

<svelte:head>
	<title>{isSuccess ? 'Consultation Confirmed' : 'Complete Consultation Payment'} — Neubofy</title>
</svelte:head>

<div class="min-h-screen bg-[#09090b] text-zinc-100 py-12 px-4 flex flex-col justify-between items-center selection:bg-blue-600/30">
	<div class="max-w-xl w-full my-auto space-y-6 animate-fade-in">
		{#if isSuccess}
			<!-- Payment Success & Consultation Confirmed -->
			<div class="glass-card rounded-3xl border border-emerald-500/20 p-8 sm:p-10 text-center shadow-2xl space-y-6 bg-gradient-to-b from-emerald-950/20 to-zinc-950/40">
				<div class="w-16 h-16 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto text-3xl shadow-[0_0_25px_rgba(16,185,129,0.3)]">
					✓
				</div>
				<div>
					<span class="text-[10px] font-bold uppercase tracking-wider text-emerald-400 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
						Payment Confirmed
					</span>
					<h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-3">
						Consultation Confirmed!
					</h1>
					<p class="text-xs sm:text-sm text-zinc-400 mt-2 max-w-md mx-auto leading-relaxed">
						Your consultation with <strong class="text-zinc-200">{data.booking.host_name}</strong> is confirmed. A calendar invitation with meeting details has been sent to <strong class="text-zinc-200">{data.booking.attendee_email}</strong>.
					</p>
				</div>

				<div class="p-5 rounded-2xl bg-black/50 border border-white/10 text-left text-xs space-y-2.5">
					<div class="flex justify-between py-1 border-b border-white/5">
						<span class="text-zinc-400">Service</span>
						<span class="text-white font-semibold">{data.booking.event_name}</span>
					</div>
					<div class="flex justify-between py-1 border-b border-white/5">
						<span class="text-zinc-400">Specialist</span>
						<span class="text-white font-semibold">{data.booking.host_name}</span>
					</div>
					<div class="flex justify-between py-1 border-b border-white/5">
						<span class="text-zinc-400">Time</span>
						<span class="text-white font-semibold">{formatDateTime(data.booking.start_time)}</span>
					</div>
					<div class="flex justify-between py-1">
						<span class="text-zinc-400">Amount Paid</span>
						<span class="text-emerald-400 font-bold">₹{data.booking.price_amount}</span>
					</div>
				</div>

				{#if data.booking.meeting_url}
					<div class="pt-2">
						<a
							href={data.booking.meeting_url}
							target="_blank"
							rel="noopener noreferrer"
							class="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all"
						>
							<span>Join Meeting Room →</span>
						</a>
					</div>
				{/if}

				<div class="pt-2">
					<a
						href="/"
						class="text-xs text-zinc-400 hover:text-white transition"
					>
						← Return to Neubofy Portal
					</a>
				</div>
			</div>
		{:else}
			<!-- Interim UPI Payment Screen -->
			<div class="glass-card rounded-3xl border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6 bg-zinc-950/60">
				<!-- Header -->
				<div class="border-b border-white/10 pb-4">
					<div class="flex items-center justify-between">
						<span class="text-[10px] font-bold uppercase tracking-wider text-blue-400 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
							Consultation Payment
						</span>
						<span class="text-xs text-zinc-500 font-mono">
							ID: {data.booking.id.slice(0, 8)}
						</span>
					</div>
					<h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight mt-2">
						Complete Consultation Payment
					</h1>
					<p class="text-xs text-zinc-400 mt-1">
						Transfer via UPI and confirm your payment below to schedule your consultation.
					</p>
				</div>

				{#if form?.error}
					<div class="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold">
						✕ {form.error}
					</div>
				{/if}

				<!-- Consultation Overview -->
				<div class="p-4 rounded-2xl bg-black/40 border border-white/10 text-xs space-y-2">
					<div class="flex justify-between py-1 border-b border-white/5">
						<span class="text-zinc-400">Consultation Service:</span>
						<span class="text-white font-semibold">{data.booking.event_name}</span>
					</div>
					<div class="flex justify-between py-1 border-b border-white/5">
						<span class="text-zinc-400">Specialist:</span>
						<span class="text-white font-semibold">{data.booking.host_name}</span>
					</div>
					<div class="flex justify-between py-1 border-b border-white/5">
						<span class="text-zinc-400">Scheduled Time:</span>
						<span class="text-white font-semibold">{formatDateTime(data.booking.start_time)}</span>
					</div>
					<div class="flex justify-between py-1">
						<span class="text-zinc-400">Attendee:</span>
						<span class="text-white font-semibold">{data.booking.attendee_name}</span>
					</div>
				</div>

				<!-- Amount & UPI Details Box -->
				<div class="p-6 rounded-2xl bg-gradient-to-br from-blue-950/40 via-zinc-900/60 to-zinc-950 border border-blue-500/20 text-center space-y-4">
					<div>
						<span class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Total Amount Due</span>
						<div class="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-1">
							₹{data.booking.price_amount}
						</div>
					</div>

					<div class="p-3.5 rounded-xl bg-black/60 border border-white/10 flex items-center justify-between gap-3 max-w-sm mx-auto">
						<div class="text-left">
							<span class="text-[10px] text-zinc-500 uppercase font-bold block">UPI ID</span>
							<span class="text-sm font-mono text-blue-300 font-semibold">{data.upiId}</span>
						</div>
						<button
							type="button"
							onclick={copyUpiId}
							class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition flex items-center gap-1.5"
						>
							{#if copied}
								<span class="text-emerald-400 font-bold">✓ Copied</span>
							{:else}
								<span>Copy</span>
							{/if}
						</button>
					</div>

					<!-- UPI Deep Link Button for Mobile -->
					<div class="pt-1">
						<a
							href={data.upiUri}
							class="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-semibold transition"
						>
							<span>📱 Pay with UPI App (GPay / PhonePe / Paytm)</span>
						</a>
					</div>
				</div>

				<!-- Explanatory note -->
				<div class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs leading-relaxed space-y-1">
					<p class="font-bold flex items-center gap-1.5">
						<span>ℹ️</span> Direct UPI Verification
					</p>
					<p class="text-[11px] text-amber-200/80">
						Please make payment via UPI to <strong>{data.upiId}</strong>. Once done, tap the <strong>"I've Paid"</strong> button below to instantly finalize your booking and receive meeting room details.
					</p>
				</div>

				<!-- Confirm Payment Action -->
				<form
					method="POST"
					action="?/confirmPayment"
					use:enhance={() => {
						confirming = true;
						return async ({ update }) => {
							await update();
							confirming = false;
						};
					}}
				>
					<button
						type="submit"
						disabled={confirming}
						class="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
					>
						{#if confirming}
							<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
							<span>Confirming Payment & Scheduling...</span>
						{:else}
							<span>✓ I've Paid — Confirm Booking</span>
						{/if}
					</button>
				</form>
			</div>
		{/if}
	</div>
	<Footer class="mt-8" />
</div>
