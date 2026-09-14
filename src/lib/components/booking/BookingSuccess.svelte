<script lang="ts">
	interface Props {
		eventName: string;
		selectedDate: string;
		selectedSlot: { start: string; end: string };
		meetingUrl: string | null;
		meetingType?: 'google_meet' | 'teams';
		brandColor: string;
		formatTimeRange: (start: string, end: string) => string;
		formatSelectedDate: (dateStr: string) => string;
	}

	let {
		eventName,
		selectedDate,
		selectedSlot,
		meetingUrl,
		meetingType = 'google_meet',
		brandColor,
		formatTimeRange,
		formatSelectedDate
	}: Props = $props();

	const meetingLabel = meetingType === 'teams' ? 'Join Microsoft Teams Meeting' : 'Join Google Meet';
</script>

<div class="glass-card rounded-3xl border border-white/10 p-6 sm:p-8 max-w-md w-full mx-2 shadow-2xl animate-fade-in">
	<div class="text-center">
		<div class="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-[0_0_24px_rgba(16,185,129,0.2)]">
			<svg class="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
			</svg>
		</div>
		<h1 class="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">You're Scheduled!</h1>
		<p class="text-zinc-400 mb-6 sm:mb-8 text-xs sm:text-sm">A calendar invitation and video link have been dispatched to your email.</p>

		<div class="p-5 rounded-2xl bg-black/40 border border-white/10 text-left mb-6 space-y-3">
			<h3 class="font-bold text-white text-sm sm:text-base">{eventName}</h3>
			<div class="space-y-2.5 text-xs text-zinc-300">
				<div class="flex items-start gap-3">
					<svg class="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
					</svg>
					<div>
						<p class="text-white font-semibold">{formatTimeRange(selectedSlot.start, selectedSlot.end)}</p>
						<p class="text-zinc-400">{formatSelectedDate(selectedDate)}</p>
					</div>
				</div>
				{#if meetingUrl}
					<div class="flex items-start gap-3 pt-1">
						<svg class="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
						</svg>
						<a href={meetingUrl} target="_blank" class="text-blue-400 hover:text-blue-300 underline font-semibold break-all">{meetingLabel}</a>
					</div>
				{/if}
			</div>
		</div>

		<a
			href="/"
			class="w-full btn-electric py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(59,130,246,0.4)]"
		>
			<span>← Return to Home</span>
		</a>
	</div>
</div>
