<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let name = $state('');
	let slug = $state('');
	let category = $state('Consultation');
	let description = $state('');
	let status = $state<'live' | 'paused'>('live');
	let priceInr = $state<number>(0);
	let selectedDurations = $state<number[]>([30, 60]);
	let selectedExpertIds = $state<string[]>(
		(data.teamMembers || []).map((m: any) => m.id)
	);
	let isSaving = $state(false);

	const durationOptions = [15, 30, 45, 60, 90];

	function toggleDuration(d: number) {
		if (selectedDurations.includes(d)) {
			if (selectedDurations.length > 1) {
				selectedDurations = selectedDurations.filter((val) => val !== d);
			}
		} else {
			selectedDurations = [...selectedDurations, d].sort((a, b) => a - b);
		}
	}

	function handleNameChange(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		name = val;
		if (!slug || slug === autoSlug(val.slice(0, -1))) {
			slug = autoSlug(val);
		}
	}

	function autoSlug(text: string) {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');
	}

	function toggleExpert(expertId: string) {
		if (selectedExpertIds.includes(expertId)) {
			selectedExpertIds = selectedExpertIds.filter((id) => id !== expertId);
		} else {
			selectedExpertIds = [...selectedExpertIds, expertId];
		}
	}

	function selectAllExperts() {
		selectedExpertIds = (data.teamMembers || []).map((m: any) => m.id);
	}

	function clearAllExperts() {
		selectedExpertIds = [];
	}
</script>

<svelte:head>
	<title>Create Consultation Service | Neubofy™</title>
</svelte:head>

<div class="p-6 sm:p-10 max-w-4xl mx-auto space-y-8 animate-fade-in">
	<!-- Top Navigation Breadcrumb -->
	<div class="flex items-center justify-between">
		<a
			href="/dashboard/event-types"
			class="inline-flex items-center text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
		>
			← Back to Consultation Services
		</a>
		<span class="text-xs text-zinc-500 font-mono">Service Builder</span>
	</div>

	<!-- Header -->
	<div>
		<h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">Create Consultation Service</h1>
		<p class="text-xs sm:text-sm text-zinc-400 mt-1">
			Define the service, configure allowable session durations, set live/paused status, and assign specialists.
		</p>
	</div>

	<!-- Error Banner -->
	{#if form?.error}
		<div class="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center justify-between">
			<span>✕ {form.error}</span>
		</div>
	{/if}

	<!-- Form Card -->
	<div class="glass-card rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl">
		<form
			method="POST"
			use:enhance={() => {
				isSaving = true;
				return async ({ update }) => {
					isSaving = false;
					await update();
				};
			}}
			class="space-y-8"
		>
			<!-- Service Name & URL Slug -->
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
				<div>
					<label for="name" class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
						Service Name *
					</label>
					<input
						type="text"
						id="name"
						name="name"
						bind:value={name}
						oninput={handleNameChange}
						required
						placeholder="e.g. Technology Strategy & Advisory"
						class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all"
					/>
				</div>

				<div>
					<label for="slug" class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
						URL Slug *
					</label>
					<div class="flex items-center rounded-xl bg-white/5 border border-white/15 overflow-hidden focus-within:border-blue-500 transition-all">
						<span class="px-3 text-xs text-zinc-500 font-mono">/</span>
						<input
							type="text"
							id="slug"
							name="slug"
							bind:value={slug}
							required
							pattern="[a-z0-9\-]+"
							placeholder="tech-strategy"
							class="w-full py-2.5 pr-4 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
						/>
					</div>
					<p class="text-[11px] text-zinc-500 mt-1">Lowercase alphanumeric and hyphens only.</p>
				</div>
			</div>

			<!-- Category & Status -->
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
				<div>
					<label for="category" class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
						Consultation Category
					</label>
					<input
						type="text"
						id="category"
						name="category"
						bind:value={category}
						placeholder="e.g. Advisory, Architecture, Audit"
						class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all"
					/>
				</div>

				<!-- Live vs Paused Status Selector -->
				<div>
					<span class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
						Initial Status *
					</span>
					<div class="grid grid-cols-2 gap-3">
						<label
							class="flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all {status === 'live'
								? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
								: 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'}"
						>
							<input
								type="radio"
								name="status"
								value="live"
								bind:group={status}
								class="sr-only"
							/>
							<span class="w-2 h-2 rounded-full {status === 'live' ? 'bg-emerald-400' : 'bg-zinc-500'}"></span>
							<div class="text-left">
								<div class="text-xs font-bold">🟢 Live</div>
								<div class="text-[10px] opacity-75">Visible to clients</div>
							</div>
						</label>

						<label
							class="flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all {status === 'paused'
								? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
								: 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'}"
						>
							<input
								type="radio"
								name="status"
								value="paused"
								bind:group={status}
								class="sr-only"
							/>
							<span class="w-2 h-2 rounded-full {status === 'paused' ? 'bg-amber-400' : 'bg-zinc-500'}"></span>
							<div class="text-left">
								<div class="text-xs font-bold">⏸️ Paused</div>
								<div class="text-[10px] opacity-75">Hidden from clients</div>
							</div>
						</label>
					</div>
				</div>
			</div>

			<!-- Consultation Fee & Pricing Control -->
			<div class="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
				<div class="flex items-center justify-between">
					<div>
						<label for="price_inr" class="block text-xs font-bold uppercase tracking-wider text-zinc-200">
							Consultation Fallback Base Fee (INR ₹)
						</label>
						<p class="text-[11px] text-zinc-400 mt-0.5">
							Primary session prices and durations are determined by each expert's profile (<span class="text-blue-400">Expert-Driven</span>). Organization coupons (e.g. 100% OFF waivers) apply at checkout.
						</p>
					</div>
					<span class="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
						Expert-Driven Pricing
					</span>
				</div>

				<div class="pt-1">
					<div class="flex items-center max-w-xs rounded-xl bg-white/5 border border-white/15 overflow-hidden focus-within:border-blue-500 transition-all">
						<span class="px-3.5 text-sm text-zinc-400 font-semibold">₹</span>
						<input
							type="number"
							id="price_inr"
							name="price_inr"
							bind:value={priceInr}
							min="0"
							step="1"
							class="w-full py-2.5 pr-4 bg-transparent text-sm text-white font-mono placeholder-zinc-500 focus:outline-none"
						/>
					</div>
					<p class="text-[10px] text-zinc-500 mt-1">Fallback price if an assigned expert does not have customized session tiers.</p>
				</div>
			</div>

			<!-- Session Duration Options (Chips) -->
			<div>
				<div class="flex items-center justify-between mb-2">
					<label class="block text-xs font-bold uppercase tracking-wider text-zinc-300">
						Available Session Durations *
					</label>
					<span class="text-[11px] text-zinc-500">Clients can choose duration when booking</span>
				</div>
				<div class="flex flex-wrap gap-2.5">
					{#each durationOptions as dur}
						<button
							type="button"
							onclick={() => toggleDuration(dur)}
							class="px-4 py-2 rounded-xl text-xs font-semibold border transition-all {selectedDurations.includes(dur)
								? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_16px_rgba(59,130,246,0.4)]'
								: 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white'}"
						>
							{dur} Minutes
						</button>
					{/each}
				</div>
				<!-- Hidden inputs for form data -->
				{#each selectedDurations as dur}
					<input type="hidden" name="durations" value={dur} />
				{/each}
			</div>

			<!-- Specialist / Expert Assignment Section -->
			<div class="pt-4 border-t border-white/10">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
					<div>
						<label class="block text-xs font-bold uppercase tracking-wider text-zinc-200">
							Assign Specialists / Experts *
						</label>
						<p class="text-[11px] text-zinc-400 mt-0.5">
							Only selected team members will be available for clients to choose under this service.
						</p>
					</div>

					<div class="flex items-center gap-2 text-xs">
						<button
							type="button"
							onclick={selectAllExperts}
							class="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
						>
							Select All
						</button>
						<span class="text-zinc-600">•</span>
						<button
							type="button"
							onclick={clearAllExperts}
							class="text-zinc-400 hover:text-white font-semibold transition-colors"
						>
							Deselect All
						</button>
					</div>
				</div>

				{#if data.teamMembers && data.teamMembers.length > 0}
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
						{#each data.teamMembers as member}
							<label
								class="flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all {selectedExpertIds.includes(member.id)
									? 'bg-blue-600/15 border-blue-500/40 text-white shadow-[0_0_12px_rgba(59,130,246,0.2)]'
									: 'bg-white/[0.02] border-white/10 text-zinc-400 hover:bg-white/5'}"
							>
								<div class="flex items-center gap-3 min-w-0">
									{#if member.profile_image}
										<img
											src={member.profile_image}
											alt={member.name}
											class="w-9 h-9 rounded-full object-cover border border-white/20 shrink-0"
										/>
									{:else}
										<div class="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs text-white shrink-0">
											{member.name?.charAt(0) || 'E'}
										</div>
									{/if}
									<div class="min-w-0 flex-1">
										<p class="text-xs font-bold text-white truncate">{member.name}</p>
										<p class="text-[11px] text-zinc-400 truncate">{member.role_title || member.role}</p>
									</div>
								</div>

								<input
									type="checkbox"
									name="assigned_experts"
									value={member.id}
									checked={selectedExpertIds.includes(member.id)}
									onchange={() => toggleExpert(member.id)}
									class="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-0 focus:ring-offset-0 shrink-0"
								/>
							</label>
						{/each}
					</div>
				{:else}
					<div class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
						⚠️ No team members found in the organization. You can assign specialists later from the Edit page.
					</div>
				{/if}
			</div>

			<!-- Description -->
			<div class="pt-4 border-t border-white/10">
				<label for="description" class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
					Service Description
				</label>
				<textarea
					id="description"
					name="description"
					bind:value={description}
					rows={4}
					placeholder="Describe what clients can expect during this consultation..."
					class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all resize-none"
				></textarea>
			</div>

			<!-- Action Buttons -->
			<div class="pt-6 border-t border-white/10 flex items-center justify-end gap-4">
				<a
					href="/dashboard/event-types"
					class="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
				>
					Cancel
				</a>
				<button
					type="submit"
					disabled={isSaving}
					class="btn-electric px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-[0_0_24px_rgba(59,130,246,0.4)] disabled:opacity-50"
				>
					<span>{isSaving ? 'Creating Service...' : 'Create Consultation Service →'}</span>
				</button>
			</div>
		</form>
	</div>
</div>
