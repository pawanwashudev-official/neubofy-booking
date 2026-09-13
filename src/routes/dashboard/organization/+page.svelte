<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();
	const organization = data.organization as Record<string, string | number | null>;
	let name = $state(String(organization?.name || 'Neubofy'));
	let slug = $state(String(organization?.slug || 'neubofy'));
	let profileImage = $state(String(organization?.profile_image || ''));
	let brandColor = $state(String(organization?.brand_color || '#2563eb'));
	let timezone = $state(String(organization?.timezone || 'UTC'));
	let contactEmail = $state(String(organization?.contact_email || ''));
	let replyToEmail = $state(String(organization?.reply_to_email || ''));
	let emailFrom = $state(String(organization?.email_from || ''));
	let saving = $state(false);
	let message = $state('');
	let errorMessage = $state('');

	async function save() {
		saving = true;
		message = '';
		errorMessage = '';
		const response = await fetch('/api/organization', {
			method: 'PUT', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, slug, profileImage, brandColor, timezone, contactEmail, replyToEmail, emailFrom })
		});
		if (!response.ok) {
			errorMessage = ((await response.json().catch(() => ({}))) as { message?: string }).message || 'Unable to save organization settings';
		} else {
			message = 'Organization settings saved.';
			setTimeout(() => goto('/dashboard'), 600);
		}
		saving = false;
	}
</script>

<svelte:head><title>Organization setup | Neubofy</title></svelte:head>

<div class="min-h-screen bg-slate-50">
	<header class="border-b border-slate-200 bg-white">
		<div class="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
			<a href="/dashboard" class="text-sm font-medium text-slate-600 hover:text-slate-900">Back</a>
			<div><p class="text-xs font-semibold uppercase tracking-wider text-blue-600">Neubofy</p><h1 class="text-xl font-bold text-slate-900">Organization setup</h1></div>
		</div>
	</header>
	<main class="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
		<div class="mb-6 max-w-2xl"><h2 class="text-2xl font-bold text-slate-950">Make your booking portal yours</h2><p class="mt-2 text-sm leading-6 text-slate-600">These settings control the public booking page and every automated email. You can change them later from this page.</p></div>
		{#if errorMessage}<div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errorMessage}</div>{/if}
		{#if message}<div class="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</div>{/if}
		<form onsubmit={(event) => { event.preventDefault(); save(); }} class="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
			<div class="grid gap-5 sm:grid-cols-2">
				<label class="block text-sm font-medium text-slate-700">Organization name<input bind:value={name} required class="mt-2 w-full rounded-lg border-slate-300 px-3 py-2.5" /></label>
				<label class="block text-sm font-medium text-slate-700">Public URL slug<input bind:value={slug} required pattern="[a-z0-9-]+" class="mt-2 w-full rounded-lg border-slate-300 px-3 py-2.5" /><span class="mt-1 block text-xs font-normal text-slate-500">Your public page uses /{slug}</span></label>
				<label class="block text-sm font-medium text-slate-700">Contact email<input type="email" bind:value={contactEmail} required class="mt-2 w-full rounded-lg border-slate-300 px-3 py-2.5" /></label>
				<label class="block text-sm font-medium text-slate-700">Sender email<input type="email" bind:value={emailFrom} required class="mt-2 w-full rounded-lg border-slate-300 px-3 py-2.5" /><span class="mt-1 block text-xs font-normal text-slate-500">Must be approved by your email provider.</span></label>
				<label class="block text-sm font-medium text-slate-700">Reply-to email<input type="email" bind:value={replyToEmail} required class="mt-2 w-full rounded-lg border-slate-300 px-3 py-2.5" /></label>
				<label class="block text-sm font-medium text-slate-700">Timezone<input bind:value={timezone} required class="mt-2 w-full rounded-lg border-slate-300 px-3 py-2.5" /></label>
			</div>
			<label class="block text-sm font-medium text-slate-700">Logo URL<input bind:value={profileImage} placeholder="https://..." class="mt-2 w-full rounded-lg border-slate-300 px-3 py-2.5" /></label>
			<div class="flex flex-wrap items-center gap-4"><label class="text-sm font-medium text-slate-700">Brand color<input type="color" bind:value={brandColor} class="ml-3 h-10 w-14 rounded border border-slate-300" /></label><span class="text-sm text-slate-500">Used on your booking page and email buttons</span></div>
			<div class="flex justify-end"><button disabled={saving} class="w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto">{saving ? 'Saving...' : 'Save organization setup'}</button></div>
		</form>
	</main>
</div>
