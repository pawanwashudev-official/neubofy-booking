<script lang="ts">
	import {
		TIMEZONE_OPTIONS,
		getCurrentTime,
		detectTimezone
	} from '$lib/constants/timezones';

	interface Props {
		selectedTimezone: string;
		onSelect: (tz: string) => void;
		onClose: () => void;
		brandColor?: string;
	}

	let { selectedTimezone, onSelect, onClose, brandColor = '#3b82f6' }: Props = $props();

	let searchQuery = $state('');
	let selectedRegion = $state<string>('all');
	let searchInput: HTMLInputElement;

	const regions = ['all', 'Asia', 'US/Canada', 'Europe', 'Australia', 'Middle East', 'Latin America', 'Africa'];

	const filteredTimezones = $derived.by(() => {
		let list = TIMEZONE_OPTIONS;
		if (selectedRegion !== 'all') {
			list = list.filter((t) => t.region === selectedRegion);
		}
		const q = searchQuery.trim().toLowerCase();
		if (!q) return list;
		return list.filter(
			(t) =>
				t.label.toLowerCase().includes(q) ||
				t.value.toLowerCase().includes(q) ||
				t.offsetLabel.toLowerCase().includes(q) ||
				t.region.toLowerCase().includes(q)
		);
	});

	function handleSelect(tz: string) {
		onSelect(tz);
		onClose();
	}

	function handleAutoDetect() {
		const detected = detectTimezone();
		onSelect(detected);
		onClose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}

	$effect(() => {
		searchInput?.focus();
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<button
	type="button"
	class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 cursor-default"
	onclick={onClose}
	aria-label="Close timezone selector"
></button>

<!-- Modal Card -->
<div
	class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-lg bg-[#121216] border border-white/15 rounded-2xl shadow-2xl z-50 max-h-[82vh] flex flex-col overflow-hidden text-white animate-fade-in"
	role="dialog"
	aria-modal="true"
	aria-label="Select Consultation Timezone"
>
	<!-- Search & Header -->
	<div class="p-4 border-b border-white/10 bg-black/30 space-y-3">
		<div class="flex items-center justify-between">
			<span class="text-xs font-bold uppercase tracking-wider text-zinc-300">Choose Consultation Timezone</span>
			<button
				type="button"
				onclick={handleAutoDetect}
				class="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 transition-all"
				title="Detect local device timezone"
			>
				<span>📍</span>
				<span>Auto-detect My Timezone</span>
			</button>
		</div>

		<!-- Search Input -->
		<div class="relative">
			<svg
				class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
			</svg>
			<input
				bind:this={searchInput}
				bind:value={searchQuery}
				type="text"
				placeholder="Search by city, country, or UTC offset (e.g. Kolkata, London, UTC-5)..."
				class="w-full pl-10 pr-4 py-2 text-xs bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:border-blue-500 outline-none"
			/>
		</div>

		<!-- Region Filter Chips -->
		<div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
			{#each regions as region}
				<button
					type="button"
					onclick={() => (selectedRegion = region)}
					class="px-2.5 py-0.5 rounded-lg whitespace-nowrap transition-all border {selectedRegion === region
						? 'bg-blue-600 border-blue-500 text-white font-semibold'
						: 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'}"
				>
					{region === 'all' ? 'All Regions' : region}
				</button>
			{/each}
		</div>
	</div>

	<!-- Timezone list -->
	<div class="overflow-y-auto flex-1 scrollbar-thin divide-y divide-white/5" role="listbox">
		{#each filteredTimezones as tz}
			{@const isSelected = selectedTimezone === tz.value}
			<button
				type="button"
				role="option"
				aria-selected={isSelected}
				onclick={() => handleSelect(tz.value)}
				class="w-full px-4 py-2.5 flex items-center justify-between text-left text-xs hover:bg-white/5 transition-colors {isSelected
					? 'bg-blue-600/15 text-blue-400 font-semibold border-l-2 border-blue-500'
					: 'text-zinc-300'}"
			>
				<div class="min-w-0 flex-1 pr-3">
					<div class="flex items-center gap-2">
						<span class="truncate">{tz.label}</span>
						<span class="px-1.5 py-0.5 rounded text-[9px] font-mono bg-white/10 text-zinc-400 shrink-0">
							{tz.offsetLabel}
						</span>
					</div>
					<div class="text-[10px] text-zinc-500 truncate mt-0.5 font-mono">
						{tz.value}
					</div>
				</div>
				<div class="text-right shrink-0">
					<span class="text-xs font-mono font-bold text-zinc-300 tabular-nums">
						{getCurrentTime(tz.value, true)}
					</span>
					<div class="text-[9px] text-zinc-500">Local Time</div>
				</div>
			</button>
		{/each}

		{#if filteredTimezones.length === 0}
			<div class="p-8 text-center text-xs text-zinc-500">
				No timezones found matching "{searchQuery}"
			</div>
		{/if}
	</div>

	<!-- Footer with currently active timezone -->
	<div class="px-4 py-2.5 bg-black/40 border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-400">
		<span>Active: <strong class="text-white">{selectedTimezone}</strong></span>
		<button
			type="button"
			onclick={onClose}
			class="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition"
		>
			Done
		</button>
	</div>
</div>
