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
			outlookConnected?: boolean;
			defaultAvailabilityCalendars?: 'google' | 'outlook' | 'both';
			defaultInviteCalendar?: 'google' | 'outlook';
			selectedGoogleCalendars?: string[];
		} | null;
		outlookConfigured: boolean;
	}

	let { user, outlookConfigured }: Props = $props();

	let error = $state('');
	let saveSuccess = $state('');
	let saving = $state(false);
	let loadingCalendars = $state(false);
	let googleCalendars = $state<GoogleCalendar[]>([]);
	let selectedCalendarIds = $state<Set<string>>(new Set(user?.selectedGoogleCalendars || []));

	const hasGoogle = user?.googleConnected ?? false;
	const hasOutlook = (user?.outlookConnected ?? false) && outlookConfigured;

	function getDefaultAvailability(): 'google' | 'outlook' | 'both' {
		if (user?.defaultAvailabilityCalendars) return user.defaultAvailabilityCalendars;
		if (hasGoogle && hasOutlook) return 'both';
		if (hasOutlook) return 'outlook';
		return 'google';
	}

	function getDefaultInvite(): 'google' | 'outlook' {
		if (user?.defaultInviteCalendar) return user.defaultInviteCalendar;
		if (hasGoogle) return 'google';
		if (hasOutlook) return 'outlook';
		return 'google';
	}

	let availabilityCalendars = $state(getDefaultAvailability());
	let inviteCalendar = $state(getDefaultInvite());

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
					defaultAvailabilityCalendars: availabilityCalendars,
					defaultInviteCalendar: inviteCalendar,
					selectedGoogleCalendars: Array.from(selectedCalendarIds)
				})
			});
			if (!response.ok) throw new Error('Failed to save settings');
			saveSuccess = 'Calendar preferences saved successfully!';
			setTimeout(() => (saveSuccess = ''), 3500);
		} catch (err) {
			error = 'Failed to save calendar settings';
		} finally {
			saving = false;
		}
	}

	async function disconnectOutlook() {
		if (!confirm('Are you sure you want to disconnect your Outlook calendar?')) return;
		try {
			const form = document.createElement('form');
			form.method = 'POST';
			form.action = '/auth/outlook/disconnect';
			document.body.appendChild(form);
			form.submit();
		} catch (err) {
			error = 'Failed to disconnect Outlook';
		}
	}
</script>

<div class="space-y-6 text-zinc-100">
	{#if error}
		<div class="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
			✕ {error}
		</div>
	{/if}
	{#if saveSuccess}
		<div class="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">
			✓ {saveSuccess}
		</div>
	{/if}

	<div class="space-y-4">
		<!-- Google Calendar Connection Card -->
		<div class="p-5 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<div class="flex items-center gap-4">
				<div class="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10 rounded-2xl shrink-0">
					<svg class="w-7 h-7" viewBox="0 0 512 512" fill="none">
						<path d="M390.736 121.264H121.264V390.736H390.736V121.264Z" fill="white"/>
						<path d="M390.736 512L512 390.736L451.368 380.392L390.736 390.736L379.67 446.196L390.736 512Z" fill="#EA4335"/>
						<path d="M0 390.736V471.578C0 493.912 18.088 512 40.42 512H121.264L133.714 451.368L121.264 390.736L55.198 380.392L0 390.736Z" fill="#188038"/>
						<path d="M512 121.264V40.42C512 18.088 493.912 0 471.58 0H390.736C383.36 30.072 379.671 52.2027 379.67 66.392C379.67 80.58 383.359 98.8707 390.736 121.264C417.556 128.944 437.767 132.784 451.368 132.784C464.969 132.784 485.18 128.945 512 121.264Z" fill="#1967D2"/>
						<path d="M512 121.264H390.736V390.736H512V121.264Z" fill="#FBBC04"/>
						<path d="M390.736 390.736H121.264V512H390.736V390.736Z" fill="#34A853"/>
						<path d="M390.736 0H40.422C18.088 0 0 18.088 0 40.42V390.736H121.264V121.264H390.736V0Z" fill="#4285F4"/>
					</svg>
				</div>
				<div>
					<div class="flex items-center gap-2">
						<h3 class="text-sm font-bold text-white">Google Calendar & Google Meet</h3>
						{#if user?.googleConnected}
							<span class="px-2 py-0.2 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
								Connected
							</span>
						{:else}
							<span class="px-2 py-0.2 rounded text-[10px] font-bold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
								Action Required
							</span>
						{/if}
					</div>
					<p class="text-xs text-zinc-400 mt-0.5">
						Automatically generates Google Meet rooms for client consultations and checks busy slots.
					</p>
				</div>
			</div>

			<a
				href="/auth/google-calendar"
				class="btn-electric px-5 py-2.5 rounded-xl text-xs font-bold shrink-0 text-center"
			>
				{user?.googleConnected ? 'Re-link Google Account' : 'Connect Google Calendar →'}
			</a>
		</div>

		<!-- Outlook Calendar Connection Card -->
		<div class="p-5 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<div class="flex items-center gap-4">
				<div class="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10 rounded-2xl shrink-0">
					<svg class="w-7 h-7" viewBox="0 0 48 48">
						<path fill="#40c4ff" d="M31.323,8.502L7.075,23.872l-2.085-3.29v-2.835c0-1.032,0.523-1.994,1.389-2.556l14.095-9.146c2.147-1.393,4.914-1.394,7.061-0.001L31.323,8.502z"/>
						<path fill="#1976d2" d="M27.317,5.911c0.073,0.043,0.145,0.088,0.217,0.135l11,7.136L11.259,30.47l-4.185-6.603l20.017-12.713C28.988,9.95,29.071,7.241,27.317,5.911z"/>
						<path fill="#0d47a1" d="M22.142,33.771L11.26,30.47l23.136-14.666c1.949-1.235,1.944-4.08-0.009-5.308l-0.104-0.065l0.3,0.186l7.041,4.568c0.866,0.562,1.389,1.524,1.389,2.556v2.744L22.142,33.771z"/>
						<path fill="#29b6f6" d="M20.886,43h15.523c3.646,0,6.602-2.956,6.602-6.602V17.797c0,1.077-0.554,2.079-1.466,2.652l-23.09,14.498c-1.246,0.782-2.001,2.15-2.001,3.62C16.454,41.016,18.438,43,20.886,43z"/>
						<path fill="#80d8ff" d="M27.198,42.999H11.589c-3.646,0-6.602-2.956-6.602-6.602V17.783c0,1.076,0.552,2.076,1.461,2.649l23.067,14.543c1.263,0.796,2.029,2.185,2.029,3.678C31.544,41.053,29.598,42.999,27.198,42.999z"/>
						<path fill="#1565c0" d="M6.453,23h10.094C18.454,23,20,24.546,20,26.453v10.094C20,38.454,18.454,40,16.547,40H6.453C4.546,40,3,38.454,3,36.547V26.453C3,24.546,4.546,23,6.453,23z"/>
					</svg>
				</div>
				<div>
					<div class="flex items-center gap-2">
						<h3 class="text-sm font-bold text-white">Microsoft Outlook & Teams</h3>
						{#if user?.outlookConnected}
							<span class="px-2 py-0.2 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
								Connected
							</span>
						{:else}
							<span class="px-2 py-0.2 rounded text-[10px] font-bold uppercase bg-zinc-500/15 text-zinc-400 border border-zinc-500/30">
								Optional
							</span>
						{/if}
					</div>
					<p class="text-xs text-zinc-400 mt-0.5">
						Optional Microsoft 365 calendar sync for experts using Outlook.
					</p>
				</div>
			</div>

			{#if outlookConfigured}
				{#if user?.outlookConnected}
					<button
						type="button"
						onclick={disconnectOutlook}
						class="px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 rounded-xl border border-red-500/20 transition"
					>
						Disconnect
					</button>
				{:else}
					<a
						href="/auth/outlook"
						class="px-4 py-2 text-xs font-semibold text-white bg-white/10 hover:bg-white/15 rounded-xl border border-white/15 transition text-center"
					>
						Connect Outlook
					</a>
				{/if}
			{/if}
		</div>
	</div>

	<!-- Calendar Sync Preferences -->
	{#if hasGoogle || hasOutlook}
		<div class="pt-6 border-t border-white/10 space-y-5">
			<div>
				<h3 class="text-base font-bold text-white">Sync Preferences</h3>
				<p class="text-xs text-zinc-400">Configure which calendar creates meeting rooms.</p>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div>
					<label for="inviteCalendar" class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
						Default Meeting Room Platform
					</label>
					<select
						id="inviteCalendar"
						bind:value={inviteCalendar}
						class="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs outline-none focus:border-blue-500"
					>
						<option value="google">Google Calendar (Google Meet)</option>
						{#if hasOutlook}
							<option value="outlook">Outlook Calendar (Microsoft Teams)</option>
						{/if}
					</select>
				</div>

				<div>
					<label for="availabilityCalendars" class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
						Check Availability Conflicts From
					</label>
					<select
						id="availabilityCalendars"
						bind:value={availabilityCalendars}
						class="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs outline-none focus:border-blue-500"
					>
						<option value="google">Google Calendar Only</option>
						{#if hasOutlook}
							<option value="both">Both Google & Outlook</option>
							<option value="outlook">Outlook Only</option>
						{/if}
					</select>
				</div>
			</div>

			<!-- Google Calendar multi-select list -->
			{#if hasGoogle && (availabilityCalendars === 'google' || availabilityCalendars === 'both')}
				<div class="space-y-2 pt-2">
					<label class="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
						Active Sub-Calendars to Check for Conflicts
					</label>

					{#if loadingCalendars}
						<p class="text-xs text-zinc-500">Querying accessible Google calendars...</p>
					{:else if googleCalendars.length === 0}
						<p class="text-xs text-zinc-500">No sub-calendars found. Primary calendar will be used.</p>
					{:else}
						<div class="space-y-1.5 max-h-48 overflow-y-auto p-3 rounded-xl bg-white/[0.02] border border-white/10 scrollbar-thin">
							{#each googleCalendars as calendar}
								<label class="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer text-xs">
									<input
										type="checkbox"
										checked={selectedCalendarIds.has(calendar.id)}
										onchange={() => toggleCalendar(calendar.id)}
										class="w-4 h-4 text-blue-600 bg-white/5 border-white/20 rounded"
									/>
									<span class="text-zinc-200">
										{calendar.summary}
										{#if calendar.primary}
											<span class="text-[10px] text-blue-400 font-bold ml-1">(Primary)</span>
										{/if}
									</span>
								</label>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<button
				type="button"
				onclick={saveCalendarSettings}
				disabled={saving}
				class="btn-electric px-6 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50"
			>
				{saving ? 'Saving...' : 'Save Sync Preferences'}
			</button>
		</div>
	{/if}
</div>
