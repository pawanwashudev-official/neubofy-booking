<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import TimezoneSelector from '$lib/components/TimezoneSelector.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const daysOfWeek = [
		{ id: 0, name: 'Sunday' },
		{ id: 1, name: 'Monday' },
		{ id: 2, name: 'Tuesday' },
		{ id: 3, name: 'Wednesday' },
		{ id: 4, name: 'Thursday' },
		{ id: 5, name: 'Friday' },
		{ id: 6, name: 'Saturday' }
	];

	// Initialize availability state
	let availability = $state(
		daysOfWeek.map((day) => {
			const existingRules = data.rules?.filter((r) => r.day_of_week === day.id) || [];
			return {
				day: day.id,
				name: day.name,
				enabled: data.rules?.length ? existingRules.length > 0 : (day.id >= 1 && day.id <= 5), // default Mon-Fri only if no rules exist
				startTime: existingRules[0]?.start_time || '10:00',
				endTime: existingRules[0]?.end_time || '18:00'
			};
		})
	);

	let saving = $state(false);
	let showSuccess = $state(false);
	let selectedTimezone = $state(data.timezone || 'Asia/Kolkata');
	let showTimezoneDropdown = $state(false);

	const timezoneLabels: Record<string, string> = {
		'Asia/Kolkata': 'India Standard Time (IST)',
		'America/New_York': 'Eastern Time (ET)',
		'America/Chicago': 'Central Time (CT)',
		'America/Los_Angeles': 'Pacific Time (PT)',
		'Europe/London': 'UK Time (GMT/BST)',
		'Europe/Paris': 'Central European Time (CET)',
		'Asia/Dubai': 'Gulf Standard Time (GST)',
		'Asia/Singapore': 'Singapore Time (SGT)',
		'UTC': 'Universal Coordinated Time (UTC)'
	};

	function getTimezoneLabel(tz: string): string {
		return timezoneLabels[tz] || tz;
	}

	function getCurrentTime(tz: string): string {
		try {
			return new Intl.DateTimeFormat('en-US', {
				hour: 'numeric',
				minute: '2-digit',
				hour12: true,
				timeZone: tz
			}).format(new Date());
		} catch {
			return '--:--';
		}
	}

	function handleSubmit() {
		saving = true;
		showSuccess = false;
		return async ({ update, result }: any) => {
			await update({ reset: false });
			saving = false;
			if (result.type === 'success' && result.data?.success) {
				showSuccess = true;
				setTimeout(() => (showSuccess = false), 3500);
			}
		};
	}
</script>

<svelte:head>
	<title>Working Hours & Schedule | Neubofy™</title>
</svelte:head>

<div class="p-6 sm:p-10 max-w-4xl mx-auto space-y-8 animate-fade-in">
	<div>
		<h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">Working Hours & Schedule</h1>
		<p class="text-sm text-zinc-400 mt-1">
			Define recurring days and hours when you are available for client consultations.
		</p>
	</div>

	{#if showSuccess}
		<div class="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
			✓ Availability schedule saved successfully!
		</div>
	{/if}

	{#if form?.error}
		<div class="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold">
			✕ Error: {form.error}
		</div>
	{/if}

	<!-- Timezone Selection -->
	<div class="glass-card rounded-2xl p-6 border border-white/10 space-y-3">
		<h2 class="text-base font-bold text-white">Your Timezone</h2>
		<p class="text-xs text-zinc-400">
			Consultation slots are computed based on this timezone and automatically converted for clients worldwide.
		</p>

		<div class="relative">
			<button
				type="button"
				onclick={() => (showTimezoneDropdown = !showTimezoneDropdown)}
				class="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white hover:border-blue-500 transition w-full sm:w-auto text-left"
			>
				<span>🌐</span>
				<div>
					<div class="text-xs font-bold text-white">{getTimezoneLabel(selectedTimezone)}</div>
					<div class="text-[11px] text-zinc-400">{selectedTimezone} &bull; Current Time: {getCurrentTime(selectedTimezone)}</div>
				</div>
				<span class="ml-auto text-xs text-zinc-500">▼</span>
			</button>

			{#if showTimezoneDropdown}
				<div class="absolute top-full left-0 mt-2 z-50">
					<TimezoneSelector
						{selectedTimezone}
						onSelect={(tz) => (selectedTimezone = tz)}
						onClose={() => (showTimezoneDropdown = false)}
					/>
				</div>
			{/if}
		</div>
	</div>

	<!-- Weekly Schedule Card -->
	<div class="glass-card rounded-2xl p-6 sm:p-8 border border-white/10 space-y-6">
		<div>
			<h2 class="text-base font-bold text-white">Weekly Working Hours</h2>
			<p class="text-xs text-zinc-400 mt-0.5">
				Enable the days of the week you accept consultations and set start & end times.
			</p>
		</div>

		<form method="POST" action="?/save" use:enhance={handleSubmit} class="space-y-6">
			<input type="hidden" name="rules" value={JSON.stringify(availability)} />
			<input type="hidden" name="timezone" value={selectedTimezone} />

			<div class="space-y-3">
				{#each availability as day}
					<div class="p-3.5 sm:p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
						<div class="flex items-center gap-3 min-w-[140px]">
							<input
								type="checkbox"
								bind:checked={day.enabled}
								id="day-{day.day}"
								class="w-4 h-4 rounded text-blue-600 bg-white/5 border-white/20 focus:ring-blue-500"
							/>
							<label for="day-{day.day}" class="text-xs font-bold text-white cursor-pointer select-none">
								{day.name}
							</label>
						</div>

						{#if day.enabled}
							<div class="flex items-center gap-2 text-xs">
								<input
									type="time"
									bind:value={day.startTime}
									class="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs outline-none focus:border-blue-500 font-mono"
								/>
								<span class="text-zinc-500">to</span>
								<input
									type="time"
									bind:value={day.endTime}
									class="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs outline-none focus:border-blue-500 font-mono"
								/>
							</div>
						{:else}
							<span class="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
								Unavailable
							</span>
						{/if}
					</div>
				{/each}
			</div>

			<div class="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
				<button
					type="button"
					onclick={() => {
						availability = availability.map((d) => ({
							...d,
							enabled: d.day >= 1 && d.day <= 5,
							startTime: '10:00',
							endTime: '18:00'
						}));
					}}
					class="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 transition-all"
				>
					Set Standard Business Hours (Mon-Fri, 10am - 6pm)
				</button>

				<button
					type="submit"
					disabled={saving}
					class="btn-electric px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-[0_0_20px_rgba(59,130,246,0.4)] disabled:opacity-50"
				>
					{saving ? 'Saving...' : 'Save Availability Schedule'}
				</button>
			</div>
		</form>
	</div>

	<!-- Calendar Conflict Notice -->
	<div class="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-3">
		<span class="text-base">📅</span>
		<div>
			<strong class="font-bold">Real-Time Calendar Conflict Protection</strong>
			<p class="text-zinc-400 mt-0.5 leading-relaxed">
				When clients book with you, Neubofy cross-references these working hours with your connected Google Calendar. Any busy personal appointments or conflicts are automatically blocked out in real-time.
			</p>
		</div>
	</div>
</div>
