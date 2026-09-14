<script lang="ts">
	import { ALL_COUNTRIES, POPULAR_COUNTRIES, type CountryInfo } from '$lib/constants/countries';

	interface Props {
		selectedDialCode: string;
		onSelect: (country: CountryInfo) => void;
		onClose: () => void;
	}

	let { selectedDialCode, onSelect, onClose }: Props = $props();

	let searchQuery = $state('');
	let searchInput: HTMLInputElement;

	const filteredCountries = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return ALL_COUNTRIES;
		return ALL_COUNTRIES.filter(
			(c) =>
				c.name.toLowerCase().includes(q) ||
				c.dialCode.includes(q) ||
				c.code.toLowerCase().includes(q)
		);
	});

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
	aria-label="Close country selector"
></button>

<!-- Modal Card -->
<div
	class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md bg-[#121216] border border-white/15 rounded-2xl shadow-2xl z-50 max-h-[80vh] flex flex-col overflow-hidden text-white animate-fade-in"
	role="dialog"
	aria-modal="true"
	aria-label="Select Country Code"
>
	<!-- Search Box -->
	<div class="p-4 border-b border-white/10 bg-black/30">
		<div class="flex items-center justify-between mb-2.5">
			<span class="text-xs font-bold uppercase tracking-wider text-zinc-300">Select Country Code</span>
			<button
				type="button"
				onclick={onClose}
				class="text-zinc-400 hover:text-white p-1 text-sm rounded-lg hover:bg-white/10 transition-colors"
			>
				✕
			</button>
		</div>
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
				placeholder="Search country or dial code (e.g. India, +1, +44)..."
				class="w-full pl-10 pr-4 py-2 text-xs bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:border-blue-500 outline-none"
			/>
		</div>
	</div>

	<!-- Popular shortcuts (when no search query) -->
	{#if !searchQuery.trim()}
		<div class="px-4 py-2 border-b border-white/5 bg-white/[0.02]">
			<div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Popular</div>
			<div class="flex flex-wrap gap-1.5">
				{#each POPULAR_COUNTRIES as country}
					{@const isSelected = selectedDialCode === country.dialCode}
					<button
						type="button"
						onclick={() => {
							onSelect(country);
							onClose();
						}}
						class="px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all {isSelected
							? 'bg-blue-600/30 border-blue-500 text-blue-300'
							: 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'}"
					>
						<span>{country.flag}</span>
						<span>{country.name}</span>
						<span class="text-zinc-500 text-[10px]">{country.dialCode}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Country List -->
	<div class="overflow-y-auto flex-1 scrollbar-thin divide-y divide-white/5" role="listbox">
		{#each filteredCountries as country}
			{@const isSelected = selectedDialCode === country.dialCode}
			<button
				type="button"
				role="option"
				aria-selected={isSelected}
				onclick={() => {
					onSelect(country);
					onClose();
				}}
				class="w-full px-4 py-2.5 flex items-center justify-between text-left text-xs hover:bg-white/5 transition-colors {isSelected
					? 'bg-blue-600/15 text-blue-400 font-semibold'
					: 'text-zinc-300'}"
			>
				<div class="flex items-center gap-3 min-w-0">
					<span class="text-base shrink-0">{country.flag}</span>
					<span class="truncate">{country.name}</span>
					<span class="text-[10px] text-zinc-500 uppercase">({country.code})</span>
				</div>
				<span class="text-zinc-400 font-mono text-xs shrink-0 ml-2">{country.dialCode}</span>
			</button>
		{/each}

		{#if filteredCountries.length === 0}
			<div class="p-8 text-center text-xs text-zinc-500">
				No countries found matching "{searchQuery}"
			</div>
		{/if}
	</div>
</div>
