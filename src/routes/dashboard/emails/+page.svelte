<script lang="ts">
	import { onMount } from 'svelte';

	interface EmailTemplate {
		template_type: string;
		name: string;
		description: string;
		default_subject: string;
		id: string | null;
		is_enabled: boolean;
		subject: string;
		custom_message: string | null;
	}

	let templates = $state<EmailTemplate[]>([]);
	let loading = $state(true);
	let saving = $state<string | null>(null);
	let error = $state('');
	let success = $state('');

	// Track which template is expanded for editing
	let expandedTemplate = $state<string | null>(null);

	// Edit states for each template
	let editSubjects = $state<Record<string, string>>({});
	let editMessages = $state<Record<string, string>>({});

	onMount(async () => {
		await fetchTemplates();
	});

	async function fetchTemplates() {
		try {
			const response = await fetch('/api/email-templates');
			if (!response.ok) throw new Error('Failed to fetch templates');
			const data = await response.json() as { templates: EmailTemplate[] };
			templates = data.templates;

			// Initialize edit states
			templates.forEach(t => {
				editSubjects[t.template_type] = t.subject || t.default_subject;
				editMessages[t.template_type] = t.custom_message || '';
			});
		} catch (err: any) {
			error = err.message || 'Failed to load email templates';
		} finally {
			loading = false;
		}
	}

	async function toggleTemplate(template: EmailTemplate) {
		saving = template.template_type;
		error = '';

		try {
			const response = await fetch('/api/email-templates', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					template_type: template.template_type,
					is_enabled: !template.is_enabled,
					subject: editSubjects[template.template_type],
					custom_message: editMessages[template.template_type] || null
				})
			});

			if (!response.ok) throw new Error('Failed to update template');

			// Update local state
			templates = templates.map(t =>
				t.template_type === template.template_type
					? { ...t, is_enabled: !t.is_enabled }
					: t
			);
		} catch (err: any) {
			error = err.message || 'Failed to update template';
		} finally {
			saving = null;
		}
	}

	async function saveTemplate(template: EmailTemplate) {
		saving = template.template_type;
		error = '';
		success = '';

		try {
			const response = await fetch('/api/email-templates', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					template_type: template.template_type,
					is_enabled: template.is_enabled,
					subject: editSubjects[template.template_type],
					custom_message: editMessages[template.template_type] || null
				})
			});

			if (!response.ok) throw new Error('Failed to save template');

			// Update local state
			templates = templates.map(t =>
				t.template_type === template.template_type
					? {
						...t,
						subject: editSubjects[template.template_type],
						custom_message: editMessages[template.template_type] || null
					}
					: t
			);

			success = `${template.name} settings saved`;
			setTimeout(() => success = '', 3000);
			expandedTemplate = null;
		} catch (err: any) {
			error = err.message || 'Failed to save template';
		} finally {
			saving = null;
		}
	}

	function getTemplateIcon(type: string) {
		switch (type) {
			case 'confirmation':
				return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
			case 'cancellation':
				return 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z';
			case 'reschedule':
				return 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15';
			case 'reminder_24h':
			case 'reminder_1h':
			case 'reminder_30m':
				return 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z';
			default:
				return 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
		}
	}

	function getCategoryLabel(type: string) {
		if (type.startsWith('reminder_')) return 'Reminder';
		return 'Notification';
	}
</script>

<div class="p-6 sm:p-10 max-w-5xl mx-auto space-y-8 animate-fade-in">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">Email Notifications</h1>
			<p class="text-xs sm:text-sm text-zinc-400 mt-1">
				Configure automated client & specialist email alerts, custom subject lines, and reminder schedules.
			</p>
		</div>
		<a
			href="/dashboard"
			class="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition-all flex items-center gap-1.5 self-start sm:self-auto"
		>
			<span>← Back to Dashboard</span>
		</a>
	</div>

	{#if error}
		<div class="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center justify-between animate-fade-in">
			<span>✕ {error}</span>
			<button type="button" onclick={() => (error = '')} class="text-red-400 hover:text-white">✕</button>
		</div>
	{/if}

	{#if success}
		<div class="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-fade-in">
			<span>✓ {success}</span>
			<button type="button" onclick={() => (success = '')} class="text-emerald-400 hover:text-white">✕</button>
		</div>
	{/if}

	{#if loading}
		<div class="flex justify-center py-16">
			<div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
		</div>
	{:else}
		<!-- Info Cards Grid -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<!-- Google Calendar Notice -->
			<div class="glass-card rounded-2xl p-5 border border-emerald-500/20 bg-emerald-950/10 flex gap-3.5">
				<div class="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 text-sm">
					📅
				</div>
				<div class="text-xs text-zinc-300 space-y-1">
					<p class="font-bold text-white">Direct Calendar Invites Included</p>
					<p class="text-zinc-400 leading-relaxed">
						Attendees always receive automated calendar invitations with Google Meet / Teams links. The templates below provide additional branded communication.
					</p>
				</div>
			</div>

			<!-- Variables Box -->
			<div class="glass-card rounded-2xl p-5 border border-blue-500/20 bg-blue-950/10 flex gap-3.5">
				<div class="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 text-sm">
					⚙️
				</div>
				<div class="text-xs text-zinc-300 space-y-1">
					<p class="font-bold text-white">Dynamic Subject Variables</p>
					<div class="flex flex-wrap gap-1.5 pt-0.5">
						<code class="px-1.5 py-0.5 rounded bg-white/10 text-blue-300 font-mono text-[11px]">{'{event_name}'}</code>
						<code class="px-1.5 py-0.5 rounded bg-white/10 text-blue-300 font-mono text-[11px]">{'{host_name}'}</code>
						<code class="px-1.5 py-0.5 rounded bg-white/10 text-blue-300 font-mono text-[11px]">{'{attendee_name}'}</code>
						<code class="px-1.5 py-0.5 rounded bg-white/10 text-blue-300 font-mono text-[11px]">{'{date}'}</code>
						<code class="px-1.5 py-0.5 rounded bg-white/10 text-blue-300 font-mono text-[11px]">{'{time}'}</code>
					</div>
				</div>
			</div>
		</div>

		<!-- Booking Notifications Section -->
		<div class="space-y-4">
			<h2 class="text-base sm:text-lg font-bold text-white flex items-center gap-2">
				<span>📬</span>
				<span>Booking Lifecycle Notifications</span>
			</h2>

			<div class="space-y-3">
				{#each templates.filter(t => !t.template_type.startsWith('reminder_')) as template}
					<div class="glass-card rounded-2xl border border-white/10 hover:border-white/20 transition-all overflow-hidden">
						<div class="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
							<div class="flex items-center gap-3.5 min-w-0">
								<div class="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={getTemplateIcon(template.template_type)}></path>
									</svg>
								</div>
								<div class="min-w-0">
									<h3 class="text-sm font-bold text-white truncate">{template.name}</h3>
									<p class="text-xs text-zinc-400 truncate mt-0.5">{template.description}</p>
								</div>
							</div>

							<div class="flex items-center gap-3 shrink-0 self-end sm:self-auto">
								<button
									type="button"
									onclick={() => expandedTemplate = expandedTemplate === template.template_type ? null : template.template_type}
									class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition-all"
								>
									{expandedTemplate === template.template_type ? 'Close ✕' : 'Configure ✏️'}
								</button>

								<label class="relative inline-flex items-center cursor-pointer">
									<input
										type="checkbox"
										checked={template.is_enabled}
										onchange={() => toggleTemplate(template)}
										disabled={saving === template.template_type}
										class="sr-only peer"
									/>
									<div class="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 border border-white/10"></div>
								</label>
							</div>
						</div>

						{#if expandedTemplate === template.template_type}
							<div class="border-t border-white/10 p-5 bg-black/30 space-y-4">
								<div>
									<label class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
										Subject Line
									</label>
									<input
										type="text"
										bind:value={editSubjects[template.template_type]}
										placeholder={template.default_subject}
										class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all"
									/>
								</div>

								<div>
									<label class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
										Custom Message (Optional)
									</label>
									<textarea
										bind:value={editMessages[template.template_type]}
										placeholder="Add a personalized message that will appear in this email..."
										rows="3"
										class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all resize-none"
									></textarea>
									<p class="text-[11px] text-zinc-500 mt-1">This message is inserted into the email body sent to recipients.</p>
								</div>

								<div class="flex justify-end gap-3 pt-2">
									<button
										type="button"
										onclick={() => expandedTemplate = null}
										class="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white"
									>
										Cancel
									</button>
									<button
										type="button"
										onclick={() => saveTemplate(template)}
										disabled={saving === template.template_type}
										class="btn-electric px-5 py-2 rounded-xl text-xs font-bold shadow-[0_0_16px_rgba(59,130,246,0.3)] disabled:opacity-50"
									>
										{saving === template.template_type ? 'Saving...' : 'Save Changes'}
									</button>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<!-- Reminder Emails Section -->
		<div class="space-y-4 pt-4 border-t border-white/10">
			<div>
				<h2 class="text-base sm:text-lg font-bold text-white flex items-center gap-2">
					<span>⏰</span>
					<span>Automated Meeting Reminders</span>
				</h2>
				<p class="text-xs text-zinc-400 mt-0.5">
					Automatically dispatch reminders prior to the session start time.
				</p>
			</div>

			<div class="space-y-3">
				{#each templates.filter(t => t.template_type.startsWith('reminder_')) as template}
					<div class="glass-card rounded-2xl border border-white/10 hover:border-white/20 transition-all overflow-hidden">
						<div class="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
							<div class="flex items-center gap-3.5 min-w-0">
								<div class="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={getTemplateIcon(template.template_type)}></path>
									</svg>
								</div>
								<div class="min-w-0">
									<h3 class="text-sm font-bold text-white truncate">{template.name}</h3>
									<p class="text-xs text-zinc-400 truncate mt-0.5">{template.description}</p>
								</div>
							</div>

							<div class="flex items-center gap-3 shrink-0 self-end sm:self-auto">
								<button
									type="button"
									onclick={() => expandedTemplate = expandedTemplate === template.template_type ? null : template.template_type}
									class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition-all"
								>
									{expandedTemplate === template.template_type ? 'Close ✕' : 'Configure ✏️'}
								</button>

								<label class="relative inline-flex items-center cursor-pointer">
									<input
										type="checkbox"
										checked={template.is_enabled}
										onchange={() => toggleTemplate(template)}
										disabled={saving === template.template_type}
										class="sr-only peer"
									/>
									<div class="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 border border-white/10"></div>
								</label>
							</div>
						</div>

						{#if expandedTemplate === template.template_type}
							<div class="border-t border-white/10 p-5 bg-black/30 space-y-4">
								<div>
									<label class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
										Subject Line
									</label>
									<input
										type="text"
										bind:value={editSubjects[template.template_type]}
										placeholder={template.default_subject}
										class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all"
									/>
								</div>

								<div>
									<label class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
										Custom Message (Optional)
									</label>
									<textarea
										bind:value={editMessages[template.template_type]}
										placeholder="Add a personalized message that will appear in the reminder..."
										rows="3"
										class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all resize-none"
									></textarea>
								</div>

								<div class="flex justify-end gap-3 pt-2">
									<button
										type="button"
										onclick={() => expandedTemplate = null}
										class="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white"
									>
										Cancel
									</button>
									<button
										type="button"
										onclick={() => saveTemplate(template)}
										disabled={saving === template.template_type}
										class="btn-electric px-5 py-2 rounded-xl text-xs font-bold shadow-[0_0_16px_rgba(59,130,246,0.3)] disabled:opacity-50"
									>
										{saving === template.template_type ? 'Saving...' : 'Save Changes'}
									</button>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<!-- Automated Cron Notice -->
		<div class="glass-card rounded-2xl p-4 border border-white/10 bg-white/[0.02] flex items-center gap-3 text-xs text-zinc-400">
			<span class="text-base">ℹ️</span>
			<span>Reminders are processed continuously via scheduled Cloudflare cron triggers based on your organization timezone.</span>
		</div>
	{/if}
</div>
