<script lang="ts">
	import { formatSelectedDate } from '$lib/utils/dateFormatters';

	interface TimeSlot {
		start: string;
		end: string;
	}

	interface Props {
		selectedDate: string;
		availableSlots: TimeSlot[];
		selectedSlot: TimeSlot | null;
		loading: boolean;
		brandColor: string;
		formatTime: (isoStr: string) => string;
		onSelectSlot: (slot: TimeSlot) => void;
		onConfirm: () => void;
	}

	let {
		selectedDate,
		availableSlots,
		selectedSlot,
		loading,
		brandColor,
		formatTime,
		onSelectSlot,
		onConfirm
	}: Props = $props();
</script>

<div class="w-52 ml-6 border-l border-white/10 pl-6 flex flex-col" style="max-height: 400px;">
	<h3 class="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4 flex-shrink-0">
		{formatSelectedDate(selectedDate).split(',')[0]}
	</h3>

	{#if loading}
		<div class="flex items-center justify-center py-8">
			<div class="animate-spin rounded-full h-7 w-7 border-2 border-blue-500 border-t-transparent"></div>
		</div>
	{:else if availableSlots.length === 0}
		<p class="text-xs text-zinc-500 py-4">No available times</p>
	{:else}
		<div class="space-y-2 overflow-y-auto flex-1 pr-2 pb-2 scrollbar-thin">
			{#each availableSlots as slot}
				{#if selectedSlot === slot}
					<div class="flex gap-2">
						<button type="button" class="flex-1 py-2 px-2.5 border border-blue-500 bg-blue-600/30 text-white rounded-xl text-xs font-bold">
							{formatTime(slot.start)}
						</button>
						<button
							type="button"
							onclick={onConfirm}
							class="flex-1 py-2 px-2.5 btn-electric text-white rounded-xl text-xs font-bold transition shadow-[0_0_12px_rgba(59,130,246,0.5)]"
						>
							Next →
						</button>
					</div>
				{:else}
					<button
						type="button"
						onclick={() => onSelectSlot(slot)}
						class="w-full py-2.5 px-3 border border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-semibold transition text-center hover:border-blue-500/40"
					>
						{formatTime(slot.start)}
					</button>
				{/if}
			{/each}
		</div>
	{/if}
</div>
