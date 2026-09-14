<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let eventTypes = $state<any[]>(data.eventTypes || []);
	let actionMessage = $state<string>('');
	let actionError = $state<string>('');
	let togglingId = $state<string | null>(null);
	let deletingId = $state<string | null>(null);

	// Toggle Service Status (Live vs Paused)
	async function toggleStatus(service: any) {
		togglingId = service.id;
		actionMessage = '';
		actionError = '';

		const nextStatus = service.is_active === 1 ? 0 : 1;

		try {
			const res = await fetch('/api/event-type/toggle', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: service.id, is_active: nextStatus })
			});

			if (!res.ok) {
				const json = (await res.json().catch(() => ({}))) as any;
				throw new Error(json.message || 'Failed to update service status');
			}

			// Update in local state
			service.is_active = nextStatus;
			eventTypes = [...eventTypes];
			actionMessage = `${service.name} is now ${nextStatus === 1 ? 'Live (available on booking portal)' : 'Paused (hidden from clients)'}.`;
			setTimeout(() => (actionMessage = ''), 5000);
		} catch (err: any) {
			actionError = err.message || 'Failed to toggle service status.';
			setTimeout(() => (actionError = ''), 5000);
		} finally {
			togglingId = null;
		}
	}

	// Delete Service
	async function deleteEvent(service: any) {
		if (!confirm(`Are you sure you want to delete "${service.name}"? This will permanently remove the consultation service and its assignments.`)) {
			return;
		}

		deletingId = service.id;
		actionMessage = '';
		actionError = '';

		try {
			const res = await fetch(`/api/event-type/${service.slug || service.id}`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' }
			});

			if (!res.ok) {
				const json = (await res.json().catch(() => ({}))) as any;
				throw new Error(json.message || 'Failed to delete consultation service');
			}

			eventTypes = eventTypes.filter((e) => e.id !== service.id);
			actionMessage = `"${service.name}" was successfully deleted.`;
			setTimeout(() => (actionMessage = ''), 5000);
		} catch (err: any) {
			actionError = err.message || 'Error deleting service.';
			setTimeout(() => (actionError = ''), 5000);
		} finally {
			deletingId = null;
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
				Manage live & paused consultation pillars, session duration tiers, and assigned specialists.
			</p>
		</div>

		<a
			href="/dashboard/event-types/new"
			class="btn-electric px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-[0_0_20px_rgba(59,130,246,0.4)] flex items-center gap-1.5"
		>
			<span>+ Create Consultation Service</span>
		</a>
	</div>

	<!-- Status Feedback Banners -->
	{#if actionMessage}
		<div class="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-fade-in">
			<span>✓ {actionMessage}</span>
			<button type="button" onclick={() => (actionMessage = '')} class="text-emerald-400 hover:text-white">✕</button>
		</div>
	{/if}
	{#if actionError}
		<div class="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center justify-between animate-fade-in">
			<span>✕ {actionError}</span>
			<button type="button" onclick={() => (actionError = '')} class="text-red-400 hover:text-white">✕</button>
		</div>
	{/if}

	<!-- Services Grid / List -->
	<div class="space-y-4">
		{#if eventTypes.length > 0}
			{#each eventTypes as service (service.id)}
				<div class="glass-card rounded-2xl p-6 sm:p-7 border border-white/10 hover:border-white/20 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6">
					<div class="space-y-3 flex-1 min-w-0">
						<!-- Top Pills: Category, Live/Paused Badge, URL -->
						<div class="flex flex-wrap items-center gap-2.5">
							<span class="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
								{service.category || 'Consultation'}
							</span>

							{#if service.is_active === 1}
								<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
									<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
									Live (Active)
								</span>
							{:else}
								<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-500/20 text-zinc-400 border border-zinc-500/30">
									<span class="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
									Paused (Hidden)
								</span>
							{/if}

							<span class="text-xs text-zinc-500 font-mono">/{service.slug}</span>
						</div>

						<!-- Service Title & Description -->
						<div>
							<h3 class="text-lg sm:text-xl font-bold text-white leading-snug">
								{service.name}
							</h3>
							<p class="text-xs sm:text-sm text-zinc-400 mt-1 line-clamp-2 max-w-2xl leading-relaxed">
								{service.description || 'No description provided.'}
							</p>
						</div>

						<!-- Durations & Assigned Specialists Details -->
						<div class="flex flex-wrap items-center gap-4 text-xs text-zinc-400 pt-1">
							<span class="flex items-center gap-1 text-zinc-300">
								⏱ Durations: <strong>{service.durations ? service.durations.join(', ') : (service.duration_minutes || 30)} mins</strong>
							</span>

							<span class="text-zinc-600">•</span>

							<!-- Assigned Specialists Indicator -->
							<div class="flex items-center gap-2">
								<span class="text-zinc-400">Specialists:</span>
								{#if service.assigned_experts && service.assigned_experts.length > 0}
									<div class="flex items-center -space-x-1.5">
										{#each service.assigned_experts.slice(0, 4) as exp}
											{#if exp.profile_image}
												<img
													src={exp.profile_image}
													alt={exp.name}
													title="{exp.name} ({exp.role_title || 'Expert'})"
													class="w-6 h-6 rounded-full object-cover border border-white/20"
												/>
											{:else}
												<div
													title="{exp.name} ({exp.role_title || 'Expert'})"
													class="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white border border-white/20"
												>
													{exp.name?.charAt(0) || 'E'}
												</div>
											{/if}
										{/each}
									</div>
									<span class="text-xs text-zinc-300 font-medium">
										{service.assigned_experts.map((e: any) => e.name).join(', ')}
									</span>
								{:else}
									<span class="text-amber-400 text-xs flex items-center gap-1">
										⚠️ No specialists assigned
									</span>
								{/if}
							</div>
						</div>
					</div>

					<!-- Action Controls: Pause/Live, Edit, Delete -->
					<div class="flex flex-wrap items-center gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/10">
						<!-- Instant Pause / Make Live Toggle Button -->
						{#if service.is_active === 1}
							<button
								type="button"
								disabled={togglingId === service.id}
								onclick={() => toggleStatus(service)}
								class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
								title="Pause this service so clients cannot book it temporarily"
							>
								<span>⏸️</span>
								<span>{togglingId === service.id ? 'Updating...' : 'Pause Service'}</span>
							</button>
						{:else}
							<button
								type="button"
								disabled={togglingId === service.id}
								onclick={() => toggleStatus(service)}
								class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
								title="Make this service live on the booking portal"
							>
								<span>▶️</span>
								<span>{togglingId === service.id ? 'Updating...' : 'Make Live'}</span>
							</button>
						{/if}

						<!-- Edit & Assign Experts -->
						<a
							href="/dashboard/event-types/{service.id}"
							class="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 transition-all flex items-center gap-1.5"
						>
							<span>✏️</span>
							<span>Edit & Assign Experts</span>
						</a>

						<!-- Delete Button -->
						<button
							type="button"
							disabled={deletingId === service.id}
							onclick={() => deleteEvent(service)}
							title="Permanently delete this service"
							class="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-xl transition-all text-xs disabled:opacity-50"
						>
							🗑️
						</button>
					</div>
				</div>
			{/each}
		{:else}
			<!-- Empty State -->
			<div class="glass-card rounded-3xl p-12 text-center border border-white/10 max-w-md mx-auto space-y-4">
				<div class="w-16 h-16 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-3xl">
					📅
				</div>
				<h3 class="text-lg font-bold text-white">No Consultation Services Yet</h3>
				<p class="text-xs text-zinc-400 leading-relaxed">
					Create your first consultation service, select which team experts can be booked, and publish it live for clients.
				</p>
				<div class="pt-2">
					<a
						href="/dashboard/event-types/new"
						class="btn-electric px-6 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-[0_0_24px_rgba(59,130,246,0.4)]"
					>
						<span>+ Create Consultation Service</span>
						<span>→</span>
					</a>
				</div>
			</div>
		{/if}
	</div>
</div>
