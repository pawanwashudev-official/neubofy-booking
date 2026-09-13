<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	interface Member {
		user_id: string;
		name: string;
		email: string;
		role: 'owner' | 'admin' | 'member';
		is_active: number;
		joined_at: string;
		last_login_at: string | null;
		event_count: number;
		booking_count: number;
	}

	let { data }: { data: PageData } = $props();
	let members = $state<Member[]>([]);
	let loading = $state(true);
	let errorMessage = $state('');
	let successMessage = $state('');

	onMount(loadMembers);

	async function loadMembers() {
		try {
			const response = await fetch('/api/organization/users');
			if (!response.ok) throw new Error('Failed to load organization users');
			members = (await response.json() as { members: Member[] }).members;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to load organization users';
		} finally {
			loading = false;
		}
	}

	async function removeMember(member: Member) {
		if (!confirm(`Delete ${member.name} and all of their bookings, event types, availability, and account data? This cannot be undone.`)) return;
		const confirmation = prompt(`Type ${member.name} to confirm deletion.`);
		if (confirmation !== member.name) return;
		const response = await fetch('/api/organization/users', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId: member.user_id, confirmation })
		});
		if (!response.ok) {
			errorMessage = (await response.json().catch(() => ({})) as { message?: string }).message || 'Failed to delete user';
			return;
		}
		members = members.filter((current) => current.user_id !== member.user_id);
		successMessage = `${member.name} and all related data were deleted.`;
	}

	async function toggleMember(member: Member) {
		const response = await fetch('/api/organization/users', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId: member.user_id, isActive: member.is_active !== 1 })
		});
		if (!response.ok) {
			errorMessage = 'Failed to update user status';
			return;
		}
		member.is_active = member.is_active === 1 ? 0 : 1;
		members = [...members];
	}
</script>

<svelte:head><title>Organization Users</title></svelte:head>

<div class="min-h-screen bg-gray-50">
	<header class="border-b border-gray-200 bg-white">
		<div class="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
			<a href="/dashboard" class="text-sm font-medium text-gray-600 hover:text-gray-900">Back to dashboard</a>
			<div>
				<h1 class="text-xl font-bold text-gray-900">Organization users</h1>
				<p class="text-sm text-gray-500">Manage access to {data.organization?.name || 'your organization'}</p>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
		{#if errorMessage}<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{errorMessage}</div>{/if}
		{#if successMessage}<div class="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{successMessage}</div>{/if}

		<section class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
			<div class="border-b border-gray-200 px-4 py-4 sm:px-6">
				<h2 class="font-semibold text-gray-900">Members</h2>
				<p class="mt-1 text-sm text-gray-500">Deleting a member permanently removes their account and associated data.</p>
			</div>
			{#if loading}
				<div class="p-8 text-center text-sm text-gray-500">Loading users...</div>
			{:else}
				<div class="divide-y divide-gray-100">
					{#each members as member}
						<div class="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
							<div class="min-w-0">
								<div class="flex flex-wrap items-center gap-2">
									<h3 class="font-medium text-gray-900">{member.name}</h3>
									<span class="rounded-full bg-gray-100 px-2 py-1 text-xs capitalize text-gray-600">{member.role}</span>
									{#if member.is_active !== 1}<span class="rounded-full bg-red-100 px-2 py-1 text-xs text-red-700">Inactive</span>{/if}
								</div>
								<p class="truncate text-sm text-gray-500">{member.email}</p>
								<p class="mt-1 text-xs text-gray-400">{member.event_count} event types · {member.booking_count} bookings</p>
							</div>
							{#if member.role !== 'owner'}
								<div class="flex shrink-0 gap-2">
									<button onclick={() => toggleMember(member)} class="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
										{member.is_active === 1 ? 'Deactivate' : 'Activate'}
									</button>
									<button onclick={() => removeMember(member)} class="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50">Delete data</button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</main>
</div>
