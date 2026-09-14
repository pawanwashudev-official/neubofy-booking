<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let eventTypes = $state<any[]>(data.eventTypes || []);
	let deleteMessage = $state<string>('');
	let deleteError = $state<string>('');

	async function deleteEvent(service: any) {
		if (!confirm(`Delete ${service.name} and all related bookings? This cannot be undone.`)) return;
		const confirmation = prompt(`Type ${service.name} to confirm permanent deletion:`);
		if (confirmation !== service.name) return;

		try {
			const res = await fetch(`/api/event-type/${service.slug}`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ confirmation })
			});
			if (!res.ok) {
				const json = await res.json().catch(() => ({}));
				throw new Error(json.message || 'Failed to delete service');
			}
			eventTypes = eventTypes.filter((e) => e.id !== service.id);
			deleteMessage = `${service.name} was successfully deleted.`;
			setTimeout(() => (deleteMessage = ''), 4000);
		} catch (err: any) {
			deleteError = err.message || 'Error deleting service.';
		}
	}
</script>

<svelte:head>
	<title>Consultation Services Manager | Neubofy™</title>
</svelte:head>

<div class="p-6 sm:p-10 max-w-6xl mx-auto space-y-8 animate-fade-in">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">Consultation Services</h1>
			<p class="text-sm text-zinc-400 mt-1">
				Manage organization consultation pillars, session duration options, and assigned specialists.
			</p>
		</div>

		<a
			href="/dashboard/event-types/new"
			class="btn-electric px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-[0_0_20px_rgba(59,130,246,0.4)] flex items-center gap-1.5"
		>
			<span>+ Create Consultation Service</span>
		</a>
	</div>

	{#if deleteMessage}
		<div class="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
			✓ {deleteMessage}
		</div>
	{/if}
	{#if deleteError}
		<div class="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold">
			✕ {deleteError}
		</div>
	{/if}

	<!-- Services Grid / List -->
	<div class="space-y-4">
		{#if eventTypes.length > 0}
			{#each eventTypes as service}
				<div class="glass-card rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-6">
					<div class="space-y-2 flex-1 min-w-0">
						<div class="flex items-center gap-2">
							<span class="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
								{service.category || 'Advisory'}
							</span>
							{#if service.is_active === 1}
								<span class="px-2 py-0.2 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
									Active
								</span>
							{:else}
								<span class="px-2 py-0.2 rounded text-[10px] font-bold uppercase bg-zinc-500/15 text-zinc-400 border border-zinc-500/30">
									Draft
								</span>
							{/if}
							<span class="text-xs text-zinc-500">/{service.slug}</span>
						</div>

						<h3 class="text-lg font-bold text-white leading-snug">
							{service.name}
						</h3>

						<p class="text-xs text-zinc-400 max-w-2xl line-clamp-2">
							{service.description || 'No description provided'}
						</p>

						<div class="flex items-center gap-4 text-xs text-zinc-500 pt-1">
							<span>⏱ {service.duration_minutes || 30} mins</span>
							<span>👥 {service.assigned_experts_count || 'All'} assigned expert(s)</span>
							<span>📊 {service.booking_count || 0} total bookings</span>
						</div>
					</div>

					<div class="flex items-center gap-3 shrink-0">
						<a
							href="/dashboard/event-types/{service.id}"
							class="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 transition-all"
						>
							Edit & Assign Experts
						</a>

						<button
							type="button"
							onclick={() => deleteEvent(service)}
							title="Delete service"
							class="p-2 text-zinc-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors text-xs"
						>
							🗑
						</button>
					</div>
				</div>
			{/each}
		{:else}
			<div class="glass-card rounded-2xl p-12 text-center border border-white/10">
				<h3 class="text-base font-bold text-white">No Consultation Services Yet</h3>
				<p class="text-xs text-zinc-400 mt-1 max-w-sm mx-auto mb-6">
					Create your first consultation service for the organization.
				</p>
				<a
					href="/dashboard/event-types/new"
					class="btn-electric px-6 py-2.5 rounded-xl text-xs font-bold inline-block"
				>
					+ Create Service
				</a>
			</div>
		{/if}
	</div>
</div>
