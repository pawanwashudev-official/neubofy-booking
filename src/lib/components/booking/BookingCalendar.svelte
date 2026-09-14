<script lang="ts">
	import { formatDateLocal } from '$lib/utils/dateFormatters';

	interface Props {
		currentMonth: Date;
		selectedDate: string | null;
		availableDates: Set<string>;
		brandColor: string;
		brandLighter: string;
		brandDark: string;
		onDateSelect: (dateStr: string) => void;
		onPrevMonth: () => void;
		onNextMonth: () => void;
	}

	let {
		currentMonth,
		selectedDate,
		availableDates,
		brandColor,
		brandLighter,
		brandDark,
		onDateSelect,
		onPrevMonth,
		onNextMonth
	}: Props = $props();

	const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	const calendarDays = $derived(() => {
		const year = currentMonth.getFullYear();
		const month = currentMonth.getMonth();
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const startPadding = (firstDay.getDay() + 6) % 7;
		const days: Array<{ date: Date; isCurrentMonth: boolean; isAvailable: boolean; dateStr: string }> = [];

		for (let i = 0; i < startPadding; i++) {
			const date = new Date(year, month, i - startPadding + 1);
			days.push({
				date,
				isCurrentMonth: false,
				isAvailable: false,
				dateStr: formatDateLocal(date)
			});
		}

		const today = new Date();
		today.setHours(0, 0, 0, 0);
		for (let i = 1; i <= lastDay.getDate(); i++) {
			const date = new Date(year, month, i);
			const dateStr = formatDateLocal(date);
			const isAvailable = date >= today && date <= new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
			days.push({
				date,
				isCurrentMonth: true,
				isAvailable,
				dateStr
			});
		}

		const remaining = 42 - days.length;
		for (let i = 1; i <= remaining; i++) {
			const date = new Date(year, month + 1, i);
			days.push({
				date,
				isCurrentMonth: false,
				isAvailable: false,
				dateStr: formatDateLocal(date)
			});
		}

		return days;
	});

	function formatMonthYear(date: Date) {
		return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
	}
</script>

<div>
	<div class="flex items-center justify-between mb-4">
		<h3 class="text-base font-bold text-white tracking-tight">{formatMonthYear(currentMonth)}</h3>
		<div class="flex gap-1.5">
			<button type="button" onclick={onPrevMonth} class="p-2 hover:bg-white/10 rounded-xl transition text-zinc-400 hover:text-white" aria-label="Previous month">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
				</svg>
			</button>
			<button type="button" onclick={onNextMonth} class="p-2 hover:bg-white/10 rounded-xl transition text-zinc-400 hover:text-white" aria-label="Next month">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
				</svg>
			</button>
		</div>
	</div>

	<div class="grid grid-cols-7 gap-1 mb-2">
		{#each weekDays as day}
			<div class="text-center text-[11px] font-bold uppercase tracking-wider text-zinc-500 py-1.5">{day}</div>
		{/each}
	</div>

	<div class="grid grid-cols-7 gap-1.5">
		{#each calendarDays() as day}
			{@const hasSlots = availableDates.has(day.dateStr)}
			{@const isClickable = day.isAvailable && hasSlots}
			{@const isSelected = selectedDate === day.dateStr}
			<button
				type="button"
				onclick={() => isClickable && onDateSelect(day.dateStr)}
				disabled={!isClickable}
				class="aspect-square flex items-center justify-center text-xs font-semibold rounded-xl transition-all relative
					{!day.isCurrentMonth ? 'text-zinc-600 opacity-40' : ''}
					{isClickable && !isSelected ? 'text-zinc-200 hover:bg-blue-600/20 hover:text-blue-400 hover:border hover:border-blue-500/40 cursor-pointer' : ''}
					{day.isAvailable && !hasSlots && day.isCurrentMonth ? 'text-zinc-600 cursor-not-allowed' : ''}
					{!day.isAvailable && day.isCurrentMonth ? 'text-zinc-700 cursor-not-allowed' : ''}
					{isSelected ? 'bg-blue-600 text-white shadow-[0_0_16px_rgba(59,130,246,0.6)] font-bold border border-blue-400' : ''}"
			>
				{day.date.getDate()}
			</button>
		{/each}
	</div>
</div>
