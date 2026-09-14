<script lang="ts">
	import { page } from '$app/stores';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();

	let mobileMenuOpen = $state<boolean>(false);
	let selectedViewExpertId = $state<string>('');

	$effect(() => {
		if (data.user?.id && !selectedViewExpertId) {
			selectedViewExpertId = data.user.id;
		}
	});

	// Role titles
	const roleBadgeLabel = $derived(
		data.role === 'owner' ? 'Super Admin' : data.role === 'admin' ? 'Admin' : 'Expert Member'
	);
</script>

<div class="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col md:flex-row">
	<!-- Mobile Topbar -->
	<div class="md:hidden border-b border-white/10 bg-[#121216] px-4 py-3 flex items-center justify-between sticky top-0 z-40">
		<div class="flex items-center space-x-2.5">
			<img
				src={data.organization?.profile_image || 'https://neubofy.in/neubofylogo.png'}
				alt="Neubofy"
				class="w-7 h-7 rounded-full object-cover border border-white/20"
			/>
			<span class="font-bold text-white text-base tracking-tight">Neubofy™</span>
			<span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
				{roleBadgeLabel}
			</span>
		</div>
		<button
			type="button"
			onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
			class="p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-300 hover:text-white text-sm"
			aria-label="Toggle menu"
		>
			{#if mobileMenuOpen}✕{:else}☰{/if}
		</button>
	</div>

	<!-- Sidebar (Zoho Bookings Role-Aware Navigation) -->
	<aside
		class="w-full md:w-64 lg:w-72 bg-[#101014] border-r border-white/10 flex flex-col shrink-0 {mobileMenuOpen
			? 'block fixed inset-0 z-50 bg-[#101014]'
			: 'hidden md:flex'}"
	>
		<!-- Sidebar Brand Header -->
		<div class="p-5 border-b border-white/10">
			<div class="flex items-center justify-between mb-3">
				<a href="/dashboard" class="flex items-center space-x-3 group">
					<img
						src={data.organization?.profile_image || 'https://neubofy.in/neubofylogo.png'}
						alt="Neubofy"
						class="w-9 h-9 rounded-full object-cover border border-white/20 group-hover:scale-105 transition-transform"
					/>
					<div>
						<div class="font-bold text-white text-base tracking-tight leading-none">
							{data.organization?.name || 'Neubofy™'}
						</div>
						<span class="text-[11px] text-zinc-400">Consultation SaaS</span>
					</div>
				</a>
				{#if mobileMenuOpen}
					<button
						type="button"
						onclick={() => (mobileMenuOpen = false)}
						class="md:hidden text-zinc-400 hover:text-white p-1"
					>
						✕
					</button>
				{/if}
			</div>

			<div class="flex items-center justify-between pt-2">
				<span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
					{roleBadgeLabel}
				</span>
				<a
					href="/"
					target="_blank"
					class="text-[11px] font-medium text-zinc-400 hover:text-blue-400 transition-colors flex items-center gap-1"
				>
					<span>View Live Portal</span>
					<span>↗</span>
				</a>
			</div>
		</div>

		<!-- Expert Workspace Switcher (For Admins / Owners) -->
		{#if data.isAdmin && data.teamMembers && data.teamMembers.length > 0}
			<div class="p-4 border-b border-white/10 bg-white/[0.02]">
				<label for="workspace-switcher" class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
					Workspace Switcher
				</label>
				<select
					id="workspace-switcher"
					bind:value={selectedViewExpertId}
					class="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 text-xs text-white outline-none focus:border-blue-500"
				>
					<option value={data.user?.id}>⚡ My Personal Workspace</option>
					{#each data.teamMembers as member}
						{#if member.id !== data.user?.id}
							<option value={member.id}>
								👤 {member.name} ({member.role_title || member.role})
							</option>
						{/if}
					{/each}
				</select>
			</div>
		{/if}

		<!-- Navigation Links -->
		<div class="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
			<!-- Personal Workspace Section (For All Members) -->
			<div>
				<div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-3 mb-2">
					My Workspace
				</div>
				<nav class="space-y-1">
					<a
						href="/dashboard"
						class="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all {$page.url.pathname === '/dashboard'
							? 'bg-blue-600 text-white shadow-[0_0_16px_rgba(37,99,235,0.4)]'
							: 'text-zinc-400 hover:text-white hover:bg-white/5'}"
					>
						<span>📅</span>
						<span>My Appointments</span>
					</a>

					<a
						href="/dashboard/availability"
						class="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all {$page.url.pathname.startsWith('/dashboard/availability')
							? 'bg-blue-600 text-white shadow-[0_0_16px_rgba(37,99,235,0.4)]'
							: 'text-zinc-400 hover:text-white hover:bg-white/5'}"
					>
						<span>⏰</span>
						<span>Working Hours & Schedule</span>
					</a>

					<a
						href="/dashboard/calendars"
						class="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all {$page.url.pathname.startsWith('/dashboard/calendars')
							? 'bg-blue-600 text-white shadow-[0_0_16px_rgba(37,99,235,0.4)]'
							: 'text-zinc-400 hover:text-white hover:bg-white/5'}"
					>
						<div class="flex items-center gap-3">
							<span>🔗</span>
							<span>Google Calendar Sync</span>
						</div>
						{#if data.user?.googleConnected}
							<span class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
						{:else}
							<span class="w-2 h-2 rounded-full bg-amber-400"></span>
						{/if}
					</a>

					<a
						href="/dashboard/profile"
						class="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all {$page.url.pathname.startsWith('/dashboard/profile')
							? 'bg-blue-600 text-white shadow-[0_0_16px_rgba(37,99,235,0.4)]'
							: 'text-zinc-400 hover:text-white hover:bg-white/5'}"
					>
						<span>👤</span>
						<span>Profile & Session Rates</span>
					</a>
				</nav>
			</div>

			<!-- Organization Management Section (Admins & Super Admins) -->
			{#if data.isAdmin}
				<div>
					<div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-3 mb-2 flex items-center justify-between">
						<span>Organization Controls</span>
						<span class="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-zinc-400">Admin</span>
					</div>
					<nav class="space-y-1">
						<a
							href="/dashboard/analytics"
							class="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all {$page.url.pathname.startsWith('/dashboard/analytics')
								? 'bg-blue-600 text-white shadow-[0_0_16px_rgba(37,99,235,0.4)]'
								: 'text-zinc-400 hover:text-white hover:bg-white/5'}"
						>
							<span>📊</span>
							<span>Analytics & Workload</span>
						</a>

						<a
							href="/dashboard/event-types"
							class="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all {$page.url.pathname.startsWith('/dashboard/event-types')
								? 'bg-blue-600 text-white shadow-[0_0_16px_rgba(37,99,235,0.4)]'
								: 'text-zinc-400 hover:text-white hover:bg-white/5'}"
						>
							<span>🛠</span>
							<span>Consultation Services</span>
						</a>

						<a
							href="/dashboard/users"
							class="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all {$page.url.pathname.startsWith('/dashboard/users')
								? 'bg-blue-600 text-white shadow-[0_0_16px_rgba(37,99,235,0.4)]'
								: 'text-zinc-400 hover:text-white hover:bg-white/5'}"
						>
							<span>👥</span>
							<span>Team & Experts Directory</span>
						</a>

						<a
							href="/dashboard/organization"
							class="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all {$page.url.pathname.startsWith('/dashboard/organization')
								? 'bg-blue-600 text-white shadow-[0_0_16px_rgba(37,99,235,0.4)]'
								: 'text-zinc-400 hover:text-white hover:bg-white/5'}"
						>
							<span>🏢</span>
							<span>Organization Settings</span>
						</a>

						<a
							href="/dashboard/emails"
							class="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all {$page.url.pathname.startsWith('/dashboard/emails')
								? 'bg-blue-600 text-white shadow-[0_0_16px_rgba(37,99,235,0.4)]'
								: 'text-zinc-400 hover:text-white hover:bg-white/5'}"
						>
							<span>✉️</span>
							<span>Email Templates</span>
						</a>
					</nav>
				</div>
			{/if}
		</div>

		<!-- User Footer in Sidebar -->
		<div class="p-4 border-t border-white/10 bg-black/30">
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-3 min-w-0">
					{#if data.user?.profile_image}
						<img
							src={data.user.profile_image}
							alt={data.user?.name}
							class="w-9 h-9 rounded-full object-cover border border-white/20 shrink-0"
						/>
					{:else}
						<div class="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
							{data.user?.name?.charAt(0) || 'U'}
						</div>
					{/if}
					<div class="min-w-0 flex-1">
						<p class="text-xs font-bold text-white truncate">{data.user?.name}</p>
						<p class="text-[10px] text-zinc-400 truncate">{data.user?.email}</p>
					</div>
				</div>

				<form method="POST" action="/auth/logout">
					<button
						type="submit"
						title="Sign Out"
						class="p-2 text-zinc-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors text-xs"
					>
						🚪
					</button>
				</form>
			</div>
		</div>
	</aside>

	<!-- Main Workspace View Area -->
	<div class="flex-1 min-w-0 flex flex-col bg-[#09090b]">
		{@render children()}
	</div>
</div>
