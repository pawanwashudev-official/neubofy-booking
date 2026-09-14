<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();
	const organization = (data.organization as Record<string, string | number | null>) || {};

	let name = $state(String(organization?.name || 'Neubofy™'));
	let slug = $state(String(organization?.slug || 'neubofy'));
	let profileImage = $state(String(organization?.profile_image || 'https://neubofy.in/neubofylogo.png'));
	let brandColor = $state(String(organization?.brand_color || '#3b82f6'));
	let timezone = $state(String(organization?.timezone || 'Asia/Kolkata'));
	let contactEmail = $state(String(organization?.contact_email || 'contact@neubofy.in'));
	let replyToEmail = $state(String(organization?.reply_to_email || 'meet@neubofy.in'));
	let emailFrom = $state(String(organization?.email_from || 'booking@updates.neubofy.in'));
	let saving = $state(false);
	let message = $state('');
	let errorMessage = $state('');

	async function save() {
		saving = true;
		message = '';
		errorMessage = '';
		try {
			const response = await fetch('/api/organization', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, slug, profileImage, brandColor, timezone, contactEmail, replyToEmail, emailFrom })
			});
			if (!response.ok) {
				const json = (await response.json().catch(() => ({}))) as any;
				throw new Error(json.message || 'Unable to save organization settings');
			}
			message = 'Organization settings saved successfully.';
			setTimeout(() => (message = ''), 4000);
		} catch (err: any) {
			errorMessage = err.message || 'Error updating organization settings.';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Organization Settings | Neubofy™</title>
</svelte:head>

<div class="p-6 sm:p-10 max-w-4xl mx-auto space-y-8 animate-fade-in">
	<div>
		<h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">Organization Settings</h1>
		<p class="text-sm text-zinc-400 mt-1">
			Manage branding, public domain slug, notification emails, and consultation defaults.
		</p>
	</div>

	{#if message}
		<div class="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
			✓ {message}
		</div>
	{/if}
	{#if errorMessage}
		<div class="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold">
			✕ {errorMessage}
		</div>
	{/if}

	<form onsubmit={(e) => { e.preventDefault(); save(); }} class="glass-card rounded-2xl p-6 sm:p-8 border border-white/10 space-y-6">
		<h2 class="text-base font-bold text-white">General & Branding</h2>

		<div class="grid gap-5 sm:grid-cols-2">
			<div>
				<label for="org-name" class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
					Organization Name
				</label>
				<input
					id="org-name"
					bind:value={name}
					required
					class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-blue-500"
				/>
			</div>

			<div>
				<label for="org-slug" class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
					Public Portal Slug
				</label>
				<input
					id="org-slug"
					bind:value={slug}
					required
					pattern="[a-z0-9-]+"
					class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-blue-500"
				/>
			</div>

			<div>
				<label for="contact-email" class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
					Contact / Support Email
				</label>
				<input
					id="contact-email"
					type="email"
					bind:value={contactEmail}
					required
					class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-blue-500"
				/>
			</div>

			<div>
				<label for="sender-email" class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
					Sender Email (Automations)
				</label>
				<input
					id="sender-email"
					type="email"
					bind:value={emailFrom}
					required
					class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-blue-500"
				/>
			</div>

			<div>
				<label for="replyto-email" class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
					Reply-To Email
				</label>
				<input
					id="replyto-email"
					type="email"
					bind:value={replyToEmail}
					required
					class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-blue-500"
				/>
			</div>

			<div>
				<label for="org-timezone" class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
					Default Timezone
				</label>
				<input
					id="org-timezone"
					bind:value={timezone}
					required
					class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-blue-500"
				/>
			</div>
		</div>

		<div>
			<label for="logo-url" class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
				Public Logo Image URL
			</label>
			<input
				id="logo-url"
				bind:value={profileImage}
				placeholder="https://neubofy.in/neubofylogo.png"
				class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs outline-none focus:border-blue-500"
			/>
		</div>

		<div class="flex items-center gap-4 pt-2">
			<label for="brand-color" class="text-xs font-semibold uppercase tracking-wider text-zinc-400">
				Brand Accent Color:
			</label>
			<input
				id="brand-color"
				type="color"
				bind:value={brandColor}
				class="h-9 w-14 rounded-lg bg-transparent border border-white/20 cursor-pointer"
			/>
			<span class="text-xs text-zinc-500">Used for accent glows and badges across the portal.</span>
		</div>

		<div class="flex justify-end pt-4 border-t border-white/10">
			<button
				type="submit"
				disabled={saving}
				class="btn-electric px-8 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-[0_0_20px_rgba(59,130,246,0.4)] disabled:opacity-50"
			>
				{saving ? 'Saving...' : 'Save Organization Settings'}
			</button>
		</div>
	</form>
</div>
