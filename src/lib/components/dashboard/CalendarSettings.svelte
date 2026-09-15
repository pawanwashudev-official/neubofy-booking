<script lang="ts">
	import { onMount } from 'svelte';

	interface GoogleCalendar {
		id: string;
		summary: string;
		primary?: boolean;
	}

	interface Props {
		user: {
			googleConnected?: boolean;
			selectedGoogleCalendars?: string[];
		} | null;
	}

	let { user }: Props = $props();

	let error = $state('');
	let saveSuccess = $state('');
	let saving = $state(false);
	let loadingCalendars = $state(false);
	let googleCalendars = $state<GoogleCalendar[]>([]);
	let selectedCalendarIds = $state<Set<string>>(new Set(user?.selectedGoogleCalendars || []));

	const hasGoogle = user?.googleConnected ?? false;

	onMount(async () => {
		if (hasGoogle) {
			await loadGoogleCalendars();
		}
	});

	async function loadGoogleCalendars() {
		loadingCalendars = true;
		try {
			const response = await fetch('/api/calendars/google');
			if (response.ok) {
				const data = (await response.json()) as any;
				googleCalendars = data.calendars || [];
				if (selectedCalendarIds.size === 0 && googleCalendars.length > 0) {
					selectedCalendarIds = new Set(googleCalendars.map((c) => c.id));
				}
			}
		} catch (err) {
			console.error('Failed to load Google calendars:', err);
		} finally {
			loadingCalendars = false;
		}
	}

	function toggleCalendar(calendarId: string) {
		const newSet = new Set(selectedCalendarIds);
		if (newSet.has(calendarId)) {
			newSet.delete(calendarId);
		} else {
			newSet.add(calendarId);
		}
		selectedCalendarIds = newSet;
	}

	async function saveCalendarSettings() {
		saving = true;
		error = '';
		saveSuccess = '';
		try {
			const response = await fetch('/api/profile', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					defaultAvailabilityCalendars: 'google',
					defaultInviteCalendar: 'google',
					selectedGoogleCalendars: Array.from(selectedCalendarIds)
				})
			});
			if (!response.ok) throw new Error('Failed to save settings');
			saveSuccess = 'Google Calendar preferences saved successfully!';
			setTimeout(() => (saveSuccess = ''), 3500);
		} catch (err: any) {
			error = err.message || 'Failed to save calendar settings.';
		} finally {
			saving = false;
		}
	}

	async function disconnectGoogle() {
		if (!confirm('Are you sure you want to disconnect Google Calendar? Consultations will not generate Google Meet links until reconnected.')) return;
		try {
			const res = await fetch('/api/calendars/google', { method: 'DELETE' });
			if (res.ok) {
				window.location.reload();
			}
		} catch (e) {
			console.error('Failed to disconnect Google Calendar:', e);
		}
	}
</script>

<div class="space-y-6">
	{#if error}
		<div class="p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-semibold">
			✕ {error}
		</div>
	{/if}

	{#if saveSuccess}
		<div class="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold">
			✓ {saveSuccess}
		</div>
	{/if}

	<div class="space-y-4">
		<!-- Google Calendar Connection Card -->
		<div class="p-5 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<div class="flex items-center gap-4">
				<div class="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10 rounded-2xl shrink-0">
					<svg class="w-7 h-7" viewBox="0 0 24 24">
						<path fill="#4285F4" d="M19.5 3h-15C3.67 3 3 3.67 3 4.5v15c0 .83.67 1.5 1.5 1.5h15c.83 0 1.5-.67 1.5-1.5v-15c0-.83-.67-1.5-1.5-1.5z"/>
						<path fill="#fff" d="M18 18H6V8h12v10z"/>
						<path fill="#EA4335" d="M8.5 6.5h-1v-2h1v2zm8 0h-1v-2h1v2z"/>
						<path fill="#4285F4" d="M10.5 14H8v-3h2.5v3zm5 0h-2.5v-3H15v3z"/>
					</svg>
				</div>
				<div>
					<div class="flex items-center gap-2">
						<h3 class="text-sm font-bold text-white">Google Calendar & Google Meet</h3>
						{#if user?.googleConnected}
							<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
								Connected ✓
							</span>
						{:else}
							<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
								Not Connected
							</span>
						{/if}
					</div>
					<p class="text-xs text-zinc-400 mt-0.5">
						Automatically generates Google Meet rooms for client consultations, prevents double-booking, and syncs busy times.
					</p>
				</div>
			</div>

			<div class="flex items-center gap-2 shrink-0">
				{#if user?.googleConnected}
					<button
						type="button"
						onclick={disconnectGoogle}
						class="px-3.5 py-2 text-xs font-semibold text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl border border-white/10 transition"
					>
						Disconnect
					</button>
					<a
						href="/auth/google-calendar"
						class="px-4 py-2 text-xs font-bold text-white bg-white/10 hover:bg-white/15 rounded-xl border border-white/15 transition text-center"
					>
						Re-authenticate
					</a>
				{:else}
					<a
						href="/auth/google-calendar"
						class="btn-electric px-5 py-2.5 rounded-xl text-xs font-bold text-center shadow-lg"
					>
						Connect Google Calendar →
					</a>
				{/if}
			</div>
		</div>
	</div>

	<!-- Google Calendar Sync Preferences -->
	{#if hasGoogle}
		<div class="pt-6 border-t border-white/10 space-y-5">
			<div>
				<h3 class="text-base font-bold text-white">Conflict Detection</h3>
				<p class="text-xs text-zinc-400">Select which of your Google sub-calendars should block availability.</p>
			</div>

			<div class="space-y-2">
				{#if loadingCalendars}
					<div class="flex items-center gap-2 text-xs text-blue-400 py-2">
						<div class="w-3 h-3 rounded-full bg-blue-500 animate-ping"></div>
						<span>Querying accessible Google calendars...</span>
					</div>
				{:else if googleCalendars.length === 0}
					<p class="text-xs text-zinc-500">Primary Google calendar is automatically used for conflict detection.</p>
				{:else}
					<div class="space-y-1.5 max-h-56 overflow-y-auto p-3 rounded-xl bg-white/[0.02] border border-white/10 scrollbar-thin">
						{#each googleCalendars as calendar}
							<label class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 cursor-pointer text-xs transition">
								<input
									type="checkbox"
									checked={selectedCalendarIds.has(calendar.id)}
									onchange={() => toggleCalendar(calendar.id)}
									class="w-4 h-4 text-blue-600 bg-white/5 border-white/20 rounded accent-blue-600"
								/>
								<span class="text-zinc-200 flex-1">
									{calendar.summary}
									{#if calendar.primary}
										<span class="text-[10px] text-blue-400 font-bold ml-1.5">(Primary)</span>
									{/if}
								</span>
							</label>
						{/each}
					</div>
				{/if}
			</div>

			<button
				type="button"
				onclick={saveCalendarSettings}
				disabled={saving}
				class="btn-electric px-6 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50"
			>
				{saving ? 'Saving...' : 'Save Calendar Preferences'}
			</button>
		</div>
	{/if}
</div>
