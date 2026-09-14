<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import type { PageData, ActionData } from './$types';
	import Footer from '$lib/components/Footer.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let cancelling = $state(false);
	let reason = $state('');
	const success = $derived($page.url.searchParams.get('success') === 'true');

	function formatDateTime(dateStr: string) {
		const date = new Date(dateStr);
		return new Intl.DateTimeFormat('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		}).format(date);
	}

	function handleSubmit() {
		cancelling = true;
		return async ({ update }: any) => {
			await update();
			cancelling = false;
		};
	}
</script>

<svelte:head>
	<title>Cancel Booking</title>
</svelte:head>

<div class="min-h-screen bg-[#09090b] text-zinc-100 py-12 px-4 flex items-center justify-center">
	<div class="max-w-xl w-full mx-auto space-y-6 animate-fade-in">
		{#if success || data.alreadyCanceled}
			<!-- Success Message -->
			<div class="glass-card rounded-3xl border border-white/10 p-8 sm:p-10 text-center shadow-2xl space-y-4">
				<div class="w-16 h-16 bg-red-500/15 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto text-2xl">
					✕
				</div>
				<h1 class="text-2xl font-bold text-white tracking-tight">Booking Cancelled</h1>
				<p class="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-md mx-auto">
					Your consultation has been successfully cancelled and the specialist has been notified.
				</p>
				<div class="pt-4">
					<a
						href="/"
						class="btn-electric px-6 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-[0_0_20px_rgba(59,130,246,0.4)]"
					>
						<span>← Return to Consultation Portal</span>
					</a>
				</div>
			</div>
		{:else}
			<!-- Cancellation Form -->
			<div class="glass-card rounded-3xl border border-white/10 p-8 sm:p-10 shadow-2xl space-y-6">
				<div class="border-b border-white/10 pb-4">
					<span class="text-[10px] font-bold uppercase tracking-wider text-red-400 px-2.5 py-0.5 rounded bg-red-500/15 border border-red-500/30">
						Cancellation Request
					</span>
					<h1 class="text-2xl font-bold text-white tracking-tight mt-2">Cancel Consultation</h1>
					<p class="text-xs text-zinc-400 mt-1">Please confirm if you would like to release your reserved time slot.</p>
				</div>

				{#if form?.error}
					<div class="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold">
						✕ {form.error}
					</div>
				{/if}

				<div class="p-5 rounded-2xl bg-black/40 border border-white/10 space-y-2.5 text-xs">
					<h2 class="font-bold text-white text-sm mb-3">Consultation Details</h2>
					<div class="flex justify-between py-1 border-b border-white/5">
						<span class="text-zinc-400">Service:</span>
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
						<span class="text-zinc-400">Client:</span>
						<span class="text-white font-semibold">{data.booking.attendee_name}</span>
					</div>
				</div>

				<div>
					<label for="reason" class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
						Reason for cancellation (optional)
					</label>
					<textarea
						id="reason"
						name="reason"
						bind:value={reason}
						rows="3"
						class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all resize-none"
						placeholder="Let the specialist know why you're cancelling..."
					></textarea>
				</div>

				<div class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2.5">
					<span class="text-base">⚠️</span>
					<span>This action will cancel the meeting calendar invite and notify the specialist.</span>
				</div>

				<form method="POST" use:enhance={handleSubmit}>
					<input type="hidden" name="reason" value={reason} />
					<div class="flex flex-col sm:flex-row gap-3 pt-2">
						<button
							type="submit"
							disabled={cancelling}
							class="flex-1 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_16px_rgba(239,68,68,0.4)] disabled:opacity-50"
						>
							{cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
						</button>
						<a
							href="/"
							class="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 text-xs font-semibold text-center transition-all"
						>
							Keep Consultation
						</a>
					</div>
				</form>
			</div>
		{/if}
	</div>
</div>
