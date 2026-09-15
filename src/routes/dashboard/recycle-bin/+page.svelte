<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let activeTab = $state<'bookings' | 'eventTypes' | 'coupons'>('bookings');
	let actionMessage = $state('');

	function formatDateTime(dateStr: string) {
		if (!dateStr) return 'Unknown';
		const date = new Date(dateStr);
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		}).format(date);
	}
</script>

<svelte:head>
	<title>Recycle Bin | Neubofy™ Dashboard</title>
</svelte:head>

<div class="p-6 sm:p-10 max-w-7xl mx-auto space-y-8 animate-fade-in">
	<!-- Top Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<div class="flex items-center gap-2 mb-1">
				<span class="text-xs font-bold uppercase tracking-wider text-amber-400">Security & Retention</span>
				<span class="text-zinc-600">•</span>
				<span class="text-xs text-zinc-400">Audit Trail</span>
			</div>
			<h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">Recycle Bin</h1>
			<p class="text-xs sm:text-sm text-zinc-400 mt-1">
				Safely restore accidentally removed records or permanently purge them from the database.
			</p>
		</div>

		<div class="flex items-center gap-2">
			<a
				href="/dashboard"
				class="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition"
			>
				← Back to Dashboard
			</a>
		</div>
	</div>

	{#if actionMessage}
		<div class="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
			✓ {actionMessage}
		</div>
	{/if}

	<!-- Tab Switcher -->
	<div class="flex items-center gap-2 border-b border-white/10 pb-3">
		<button
			type="button"
			onclick={() => (activeTab = 'bookings')}
			class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 {activeTab === 'bookings'
				? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
				: 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'}"
		>
			<span>📅 Deleted Bookings</span>
			<span class="px-2 py-0.5 rounded-full text-[10px] bg-white/10 text-white">
				{data.bookings.length}
			</span>
		</button>

		<button
			type="button"
			onclick={() => (activeTab = 'eventTypes')}
			class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 {activeTab === 'eventTypes'
				? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
				: 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'}"
		>
			<span>⚡ Consultation Services</span>
			<span class="px-2 py-0.5 rounded-full text-[10px] bg-white/10 text-white">
				{data.eventTypes.length}
			</span>
		</button>

		<button
			type="button"
			onclick={() => (activeTab = 'coupons')}
			class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 {activeTab === 'coupons'
				? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
				: 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'}"
		>
			<span>🏷️ Deleted Coupons</span>
			<span class="px-2 py-0.5 rounded-full text-[10px] bg-white/10 text-white">
				{data.coupons.length}
			</span>
		</button>
	</div>

	<!-- TAB: Bookings -->
	{#if activeTab === 'bookings'}
		<div class="space-y-3">
			{#each data.bookings as b}
				<div class="glass-card rounded-2xl p-5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-white/20 transition">
					<div class="space-y-1">
						<div class="flex items-center gap-2.5">
							<h3 class="text-sm font-bold text-white">{b.attendee_name}</h3>
							<span class="text-xs text-zinc-400 font-mono">({b.attendee_email})</span>
							{#if b.is_paid === 1}
								<span class="px-2 py-0.2 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
									Paid ₹{b.price_amount}
								</span>
							{/if}
						</div>
						<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
							<span>Service: <strong class="text-zinc-200">{b.event_type_name || 'Consultation'}</strong></span>
							<span>Scheduled: <strong class="text-zinc-200">{formatDateTime(b.start_time)}</strong></span>
							<span>Deleted: <strong class="text-amber-300">{formatDateTime(b.deleted_at)}</strong></span>
						</div>
					</div>

					<div class="flex items-center gap-2 shrink-0">
						<form method="POST" action="?/restore" use:enhance>
							<input type="hidden" name="type" value="booking" />
							<input type="hidden" name="id" value={b.id} />
							<button
								type="submit"
								class="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 transition flex items-center gap-1.5"
							>
								<span>↺</span>
								<span>Restore</span>
							</button>
						</form>

						<form
							method="POST"
							action="?/purge"
							use:enhance={({ cancel }) => {
								if (!confirm(`Permanently purge booking for ${b.attendee_name}? This action CANNOT be undone.`)) {
									cancel();
								}
							}}
						>
							<input type="hidden" name="type" value="booking" />
							<input type="hidden" name="id" value={b.id} />
							<button
								type="submit"
								class="px-3.5 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/15 border border-red-500/25 transition flex items-center gap-1.5"
							>
								<span>🗑</span>
								<span>Purge Permanently</span>
							</button>
						</form>
					</div>
				</div>
			{/each}

			{#if data.bookings.length === 0}
				<div class="p-12 text-center glass-card rounded-2xl border border-white/10 space-y-2">
					<span class="text-3xl">✨</span>
					<h3 class="text-sm font-bold text-white">No Deleted Bookings</h3>
					<p class="text-xs text-zinc-400">All consultation bookings are active and clean.</p>
				</div>
			{/if}
		</div>
	{/if}

	<!-- TAB: Event Types -->
	{#if activeTab === 'eventTypes'}
		<div class="space-y-3">
			{#each data.eventTypes as et}
				<div class="glass-card rounded-2xl p-5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-white/20 transition">
					<div class="space-y-1">
						<div class="flex items-center gap-2.5">
							<h3 class="text-sm font-bold text-white">{et.name}</h3>
							<span class="text-xs font-mono text-zinc-400">/{et.slug}</span>
							<span class="px-2 py-0.2 rounded text-[10px] font-bold bg-white/10 text-zinc-300">
								{et.duration_minutes}m
							</span>
						</div>
						<div class="text-xs text-zinc-400">
							Deleted: <strong class="text-amber-300">{formatDateTime(et.deleted_at)}</strong>
						</div>
					</div>

					<div class="flex items-center gap-2 shrink-0">
						<form method="POST" action="?/restore" use:enhance>
							<input type="hidden" name="type" value="event_type" />
							<input type="hidden" name="id" value={et.id} />
							<button
								type="submit"
								class="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 transition flex items-center gap-1.5"
							>
								<span>↺</span>
								<span>Restore Service</span>
							</button>
						</form>

						<form
							method="POST"
							action="?/purge"
							use:enhance={({ cancel }) => {
								if (!confirm(`Permanently purge consultation service "${et.name}"? This action CANNOT be undone.`)) {
									cancel();
								}
							}}
						>
							<input type="hidden" name="type" value="event_type" />
							<input type="hidden" name="id" value={et.id} />
							<button
								type="submit"
								class="px-3.5 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/15 border border-red-500/25 transition flex items-center gap-1.5"
							>
								<span>🗑</span>
								<span>Purge Permanently</span>
							</button>
						</form>
					</div>
				</div>
			{/each}

			{#if data.eventTypes.length === 0}
				<div class="p-12 text-center glass-card rounded-2xl border border-white/10 space-y-2">
					<span class="text-3xl">✨</span>
					<h3 class="text-sm font-bold text-white">No Deleted Services</h3>
					<p class="text-xs text-zinc-400">No consultation services are in the Recycle Bin.</p>
				</div>
			{/if}
		</div>
	{/if}

	<!-- TAB: Coupons -->
	{#if activeTab === 'coupons'}
		<div class="space-y-3">
			{#each data.coupons as c}
				<div class="glass-card rounded-2xl p-5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-white/20 transition">
					<div class="space-y-1">
						<div class="flex items-center gap-2.5">
							<span class="font-mono font-bold text-sm text-white px-2 py-0.5 rounded bg-white/10 border border-white/15">
								{c.code}
							</span>
							<span class="text-xs text-blue-400 font-semibold">
								{c.discount_type === 'percentage' ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`}
							</span>
						</div>
						<div class="text-xs text-zinc-400">
							Deleted: <strong class="text-amber-300">{formatDateTime(c.deleted_at)}</strong>
						</div>
					</div>

					<div class="flex items-center gap-2 shrink-0">
						<form method="POST" action="?/restore" use:enhance>
							<input type="hidden" name="type" value="coupon" />
							<input type="hidden" name="id" value={c.id} />
							<button
								type="submit"
								class="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 transition flex items-center gap-1.5"
							>
								<span>↺</span>
								<span>Restore Coupon</span>
							</button>
						</form>

						<form
							method="POST"
							action="?/purge"
							use:enhance={({ cancel }) => {
								if (!confirm(`Permanently purge coupon code "${c.code}"? This action CANNOT be undone.`)) {
									cancel();
								}
							}}
						>
							<input type="hidden" name="type" value="coupon" />
							<input type="hidden" name="id" value={c.id} />
							<button
								type="submit"
								class="px-3.5 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/15 border border-red-500/25 transition flex items-center gap-1.5"
							>
								<span>🗑</span>
								<span>Purge Permanently</span>
							</button>
						</form>
					</div>
				</div>
			{/each}

			{#if data.coupons.length === 0}
				<div class="p-12 text-center glass-card rounded-2xl border border-white/10 space-y-2">
					<span class="text-3xl">✨</span>
					<h3 class="text-sm font-bold text-white">No Deleted Coupons</h3>
					<p class="text-xs text-zinc-400">No promotional coupon codes in the Recycle Bin.</p>
				</div>
			{/if}
		</div>
	{/if}
</div>
