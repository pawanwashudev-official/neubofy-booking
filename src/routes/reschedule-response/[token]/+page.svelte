<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import type { PageData, ActionData } from './$types';
	import Footer from '$lib/components/Footer.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const success = $derived($page.url.searchParams.get('success'));
	const action = $derived(data.action);

	const brandColor = data.proposal?.brand_color || '#3b82f6';

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

	function formatDate(dateStr: string) {
		const date = new Date(dateStr);
		return new Intl.DateTimeFormat('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		}).format(date);
	}

	function formatTime(dateStr: string) {
		const date = new Date(dateStr);
		return new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		}).format(date);
	}
</script>

<svelte:head>
	<title>Reschedule Response</title>
</svelte:head>

<div class="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col items-center justify-center p-4 selection:bg-blue-600/30">
	{#if success === 'accepted'}
		<!-- Accepted Success -->
		<div class="glass-card rounded-3xl border border-white/10 shadow-2xl p-8 max-w-md w-full text-center">
			<div class="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
				<svg class="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
				</svg>
			</div>
			<h1 class="text-2xl font-bold text-white mb-2">Meeting Rescheduled!</h1>
			<p class="text-zinc-400 text-sm mb-6">
				Your meeting has been confirmed for the new time. A calendar update has been sent to your email.
			</p>
			<div class="bg-white/5 border border-white/10 rounded-2xl p-4 text-left">
				<p class="font-semibold text-white mb-1">{data.proposal?.event_name}</p>
				<p class="text-sm text-zinc-400">{formatDateTime(data.proposal?.proposed_start_time || '')}</p>
			</div>
		</div>
	{:else if success === 'declined'}
		<!-- Declined Success -->
		<div class="glass-card rounded-3xl border border-white/10 shadow-2xl p-8 max-w-md w-full text-center">
			<div class="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
				<svg class="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
				</svg>
			</div>
			<h1 class="text-2xl font-bold text-white mb-2">Meeting Cancelled</h1>
			<p class="text-zinc-400 text-sm mb-6">
				The meeting has been cancelled. The host has been notified.
			</p>
			<a
				href="/{data.proposal?.event_slug}"
				class="inline-block px-6 py-3 text-white rounded-xl font-medium transition shadow-lg shadow-blue-500/20 hover:opacity-95"
				style="background-color: {brandColor}"
			>
				Book a New Time
			</a>
		</div>
	{:else if data.alreadyResponded}
		<!-- Already Responded -->
		<div class="glass-card rounded-3xl border border-white/10 shadow-2xl p-8 max-w-md w-full text-center">
			<div class="w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
				<svg class="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
				</svg>
			</div>
			<h1 class="text-2xl font-bold text-white mb-2">Already Responded</h1>
			<p class="text-zinc-400 text-sm">
				This reschedule request has already been {data.proposal?.status}.
			</p>
		</div>
	{:else if action === 'counter'}
		<!-- Counter Propose - Redirect to reschedule page -->
		<div class="glass-card rounded-3xl border border-white/10 shadow-2xl p-8 max-w-md w-full text-center">
			<h1 class="text-2xl font-bold text-white mb-4">Propose Different Time</h1>
			<p class="text-zinc-400 text-sm mb-6">
				You'll be redirected to choose a different time for your meeting.
			</p>
			<a
				href="/reschedule/{data.proposal?.booking_id}"
				class="inline-block px-6 py-3 text-white rounded-xl font-medium transition shadow-lg shadow-blue-500/20 hover:opacity-95"
				style="background-color: {brandColor}"
			>
				Choose Different Time
			</a>
		</div>
	{:else}
		<!-- Response Form -->
		<div class="glass-card rounded-3xl border border-white/10 shadow-2xl p-8 max-w-lg w-full">
			<h1 class="text-2xl font-bold text-white mb-2 text-center">Reschedule Request</h1>
			<p class="text-zinc-400 text-sm mb-6 text-center">
				<strong class="text-zinc-200">{data.proposal?.host_name}</strong> would like to reschedule your meeting.
			</p>

			{#if form?.error}
				<div class="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 mb-6 text-sm">
					{form.error}
				</div>
			{/if}

			{#if data.proposal?.message}
				<div class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 text-sm">
					<p class="text-amber-300">{data.proposal.message}</p>
				</div>
			{/if}

			<div class="space-y-4 mb-6">
				<!-- Original Time -->
				<div class="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
					<div class="text-xs font-semibold text-red-400 uppercase mb-2">Original Time</div>
					<div class="text-zinc-400 line-through">
						<p class="font-medium text-zinc-300">{formatDate(data.proposal?.original_start_time || '')}</p>
						<p class="text-xs">{formatTime(data.proposal?.original_start_time || '')} - {formatTime(data.proposal?.original_end_time || '')}</p>
					</div>
				</div>

				<!-- Proposed New Time -->
				<div class="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
					<div class="text-xs font-semibold text-emerald-400 uppercase mb-2">Proposed New Time</div>
					<div class="text-white">
						<p class="font-medium text-emerald-300">{formatDate(data.proposal?.proposed_start_time || '')}</p>
						<p class="text-xs text-zinc-300">{formatTime(data.proposal?.proposed_start_time || '')} - {formatTime(data.proposal?.proposed_end_time || '')}</p>
					</div>
				</div>
			</div>

			<div class="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 text-sm space-y-1">
				<p><span class="text-zinc-400">Meeting:</span> <span class="font-medium text-white">{data.proposal?.event_name}</span></p>
				<p><span class="text-zinc-400">With:</span> <span class="font-medium text-white">{data.proposal?.host_name}</span></p>
			</div>

			<div class="space-y-3">
				<form method="POST" action="?/accept" use:enhance>
					<button
						type="submit"
						class="w-full px-6 py-3 text-white rounded-xl font-medium transition bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20"
					>
						Accept New Time
					</button>
				</form>

				<form method="POST" action="?/decline" use:enhance>
					<button
						type="submit"
						class="w-full px-6 py-3 text-white rounded-xl font-medium transition bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/20"
					>
						Decline & Cancel Meeting
					</button>
				</form>

				<a
					href="/reschedule/{data.proposal?.booking_id}"
					class="block w-full px-6 py-3 text-center rounded-xl font-medium transition border border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
				>
					Propose Different Time
				</a>
			</div>
		</div>
	{/if}

	<Footer class="mt-6" />
</div>
