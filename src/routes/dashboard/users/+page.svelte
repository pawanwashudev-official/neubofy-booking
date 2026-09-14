<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	interface Member {
		user_id: string;
		name: string;
		email: string;
		role: 'owner' | 'admin' | 'member';
		role_title?: string;
		profile_image?: string | null;
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
	let inviteEmail = $state('');
	let inviteRole = $state<'member' | 'admin'>('member');
	let inviting = $state(false);

	onMount(loadMembers);

	async function loadMembers() {
		try {
			const response = await fetch('/api/organization/users');
			if (!response.ok) throw new Error('Failed to load organization team members');
			const json = (await response.json()) as { members: Member[] };
			members = json.members || [];
		} catch (error: any) {
			errorMessage = error.message || 'Failed to load team members';
		} finally {
			loading = false;
		}
	}

	async function removeMember(member: Member) {
		if (!confirm(`Remove ${member.name} from the organization? This will delete their assigned sessions.`)) return;
		const confirmation = prompt(`Type ${member.name} to confirm deletion:`);
		if (confirmation !== member.name) return;

		const response = await fetch('/api/organization/users', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId: member.user_id, confirmation })
		});

		if (!response.ok) {
			errorMessage = ((await response.json().catch(() => ({}))) as { message?: string }).message || 'Failed to remove user';
			return;
		}
		members = members.filter((current) => current.user_id !== member.user_id);
		successMessage = `${member.name} was removed from the team.`;
		setTimeout(() => (successMessage = ''), 4000);
	}

	async function toggleMember(member: Member) {
		const response = await fetch('/api/organization/users', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId: member.user_id, isActive: member.is_active !== 1 })
		});
		if (!response.ok) {
			errorMessage = 'Failed to update member status';
			return;
		}
		member.is_active = member.is_active === 1 ? 0 : 1;
		members = [...members];
	}

	async function inviteUser() {
		if (!inviteEmail || !inviteEmail.includes('@')) {
			errorMessage = 'Please enter a valid email address';
			return;
		}
		inviting = true;
		errorMessage = '';
		successMessage = '';

		try {
			const response = await fetch('/api/organization/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole })
			});
			if (!response.ok) {
				const json = (await response.json().catch(() => ({}))) as { message?: string };
				throw new Error(json.message || 'Failed to send team invitation');
			}
			successMessage = `Invitation successfully sent to ${inviteEmail}.`;
			inviteEmail = '';
			setTimeout(() => (successMessage = ''), 4000);
		} catch (err: any) {
			errorMessage = err.message || 'Error inviting member.';
		} finally {
			inviting = false;
		}
	}
</script>

<svelte:head>
	<title>Team & Experts Directory | Neubofy™</title>
</svelte:head>

<div class="p-6 sm:p-10 max-w-6xl mx-auto space-y-8 animate-fade-in">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">Team & Experts Directory</h1>
			<p class="text-sm text-zinc-400 mt-1">
				Manage organization consultants, invite specialists, and assign roles.
			</p>
		</div>
	</div>

	{#if successMessage}
		<div class="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
			✓ {successMessage}
		</div>
	{/if}
	{#if errorMessage}
		<div class="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold">
			✕ {errorMessage}
		</div>
	{/if}

	<!-- Invite New Expert Box -->
	<div class="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
		<div>
			<h2 class="text-base font-bold text-white">Invite Specialist or Administrator</h2>
			<p class="text-xs text-zinc-400 mt-0.5">
				They will receive an invitation email with access to connect their Google Calendar and host consultations.
			</p>
		</div>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				inviteUser();
			}}
			class="flex flex-col sm:flex-row gap-3"
		>
			<input
				type="email"
				bind:value={inviteEmail}
				placeholder="specialist@neubofy.in"
				required
				class="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs outline-none focus:border-blue-500"
			/>

			<select
				bind:value={inviteRole}
				class="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs outline-none focus:border-blue-500"
			>
				<option value="member">Expert Member</option>
				<option value="admin">Administrator</option>
			</select>

			<button
				type="submit"
				disabled={inviting}
				class="btn-electric px-6 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50"
			>
				{inviting ? 'Sending Invite...' : 'Send Invitation →'}
			</button>
		</form>
	</div>

	<!-- Team Members List -->
	<div class="glass-card rounded-2xl p-6 sm:p-7 border border-white/10">
		<h2 class="text-base font-bold text-white mb-1">Active Team Members ({members.length})</h2>
		<p class="text-xs text-zinc-400 mb-6">List of experts authorized to provide advisory sessions.</p>

		{#if loading}
			<div class="space-y-3">
				{#each Array(3) as _}
					<div class="p-4 rounded-xl skeleton-shimmer border border-white/5 h-20 w-full"></div>
				{/each}
			</div>
		{:else if members.length > 0}
			<div class="space-y-3">
				{#each members as member}
					<div class="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
						<div class="flex items-center gap-4">
							{#if member.profile_image}
								<img
									src={member.profile_image}
									alt={member.name}
									class="w-10 h-10 rounded-xl object-cover border border-white/10"
								/>
							{:else}
								<div class="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
									{member.name?.charAt(0) || 'M'}
								</div>
							{/if}

							<div>
								<div class="flex items-center gap-2">
									<h3 class="text-xs font-bold text-white">{member.name}</h3>
									<span class="px-2 py-0.2 rounded text-[10px] font-bold uppercase {member.role === 'owner'
										? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
										: member.role === 'admin'
											? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
											: 'bg-zinc-500/15 text-zinc-300 border border-zinc-500/30'}">
										{member.role === 'owner' ? 'Super Admin' : member.role === 'admin' ? 'Admin' : 'Expert'}
									</span>
									{#if member.is_active === 1}
										<span class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]"></span>
									{:else}
										<span class="w-2 h-2 rounded-full bg-red-400"></span>
									{/if}
								</div>
								<p class="text-[11px] text-zinc-400">{member.email}</p>
							</div>
						</div>

						<!-- Stats & Controls -->
						<div class="flex items-center gap-4 text-xs">
							<div class="text-right hidden sm:block">
								<span class="text-zinc-300 font-medium">{member.booking_count || 0} consultations</span>
								<span class="text-[10px] text-zinc-500 block">Joined {new Date(member.joined_at).toLocaleDateString()}</span>
							</div>

							<button
								type="button"
								onclick={() => toggleMember(member)}
								class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all {member.is_active === 1
									? 'bg-white/5 text-zinc-300 hover:bg-white/10 border-white/10'
									: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}"
							>
								{member.is_active === 1 ? 'Suspend' : 'Activate'}
							</button>

							{#if member.role !== 'owner'}
								<button
									type="button"
									onclick={() => removeMember(member)}
									class="p-2 text-zinc-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors text-xs"
									title="Remove user"
								>
									🗑
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="py-10 text-center text-xs text-zinc-500">
				No team members registered yet.
			</div>
		{/if}
	</div>
</div>
