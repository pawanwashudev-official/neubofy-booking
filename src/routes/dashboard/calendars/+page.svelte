<script lang="ts">
	import type { PageData } from './$types';
	import { CalendarSettings } from '$lib/components/dashboard';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Google Calendar Sync | Neubofy™</title>
</svelte:head>

<div class="p-6 sm:p-10 max-w-4xl mx-auto space-y-8 animate-fade-in">
	<div>
		<h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">Google Calendar & Meet</h1>
		<p class="text-sm text-zinc-400 mt-1">
			Connect your Google Calendar to automatically create Google Meet rooms and sync consultation appointments.
		</p>
	</div>

	<div class="glass-card rounded-2xl p-6 sm:p-8 border border-white/10">
		<CalendarSettings user={data.user} />
	</div>
</div>
