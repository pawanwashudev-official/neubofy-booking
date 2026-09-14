<script lang="ts">
	import { page } from '$app/stores';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();

	let mobileMenuOpen = $state<boolean>(false);
	let currentMode = $state<'personal' | 'org'>(data.workspaceMode || 'personal');

	async function switchWorkspace(mode: 'personal' | 'org') {
		currentMode = mode;
		await fetch('/api/workspace-mode', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ mode })
		});
		window.location.href = `/dashboard?workspace=${mode}`;
	}

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
		<div class="flex items-center space-x-2">
			<a
				href="/auth/logout"
				title="Sign Out"
				class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1 transition-all"
			>
				<span>🚪</span>
				<span>Sign Out</span>
			</a>
			<button
				type="button"
				onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
				class="p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-300 hover:text-white text-sm"
				aria-label="Toggle menu"
			>
				{#if mobileMenuOpen}✕{:else}☰{/if}
			</button>
		</div>
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

		<!-- Dual-Mode Workspace Switcher (Admins / Owners only) -->
		{#if data.isAdmin}
			<div class="p-4 border-b border-white/10 bg-white/[0.02]">
				<div class="flex items-center justify-between mb-2">
					<span class="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
						Workspace Scope
					</span>
					<span class="text-[10px] font-semibold px-2 py-0.5 rounded {currentMode === 'org' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}">
						{currentMode === 'org' ? '🏢 Org Team' : '👤 Personal'}
					</span>
				</div>

				<div class="grid grid-cols-2 p-1 bg-black/50 border border-white/10 rounded-xl gap-1">
					<button
						type="button"
						id="workspace-mode-personal"
						onclick={() => switchWorkspace('personal')}
						class="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all {currentMode === 'personal'
							? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
							: 'text-zinc-400 hover:text-white hover:bg-white/5'}"
					>
						<span>👤</span>
						<span>Personal</span>
					</button>

					<button
						type="button"
						id="workspace-mode-org"
						onclick={() => switchWorkspace('org')}
						class="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all {currentMode === 'org'
							? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
							: 'text-zinc-400 hover:text-white hover:bg-white/5'}"
					>
						<span>🏢</span>
						<span>Org Team</span>
					</button>
				</div>
			</div>
		{/if}

		<!-- Navigation Links -->
		<div class="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
			{#if currentMode === 'org' && data.isAdmin}
				<!-- Organization Workspace Controls (Admins & Super Admins) -->
				<div>
					<div class="text-[10px] font-bold uppercase tracking-wider text-indigo-400 px-3 mb-2 flex items-center justify-between">
						<span>Organization Controls</span>
						<span class="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
							Team Scope
						</span>
					</div>
					<nav class="space-y-1">
						<a
							href="/dashboard/analytics"
							class="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all {$page.url.pathname.startsWith('/dashboard/analytics')
								? 'bg-indigo-600 text-white shadow-[0_0_16px_rgba(99,102,241,0.4)]'
								: 'text-zinc-400 hover:text-white hover:bg-white/5'}"
						>
							<span>📊</span>
							<span>Analytics & Workload</span>
						</a>

						<a
							href="/dashboard?workspace=org"
							class="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all {$page.url.pathname === '/dashboard' && currentMode === 'org'
								? 'bg-indigo-600 text-white shadow-[0_0_16px_rgba(99,102,241,0.4)]'
								: 'text-zinc-400 hover:text-white hover:bg-white/5'}"
						>
							<span>📅</span>
							<span>All Team Consultations</span>
						</a>

						<a
							href="/dashboard/event-types"
							class="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all {$page.url.pathname.startsWith('/dashboard/event-types')
								? 'bg-indigo-600 text-white shadow-[0_0_16px_rgba(99,102,241,0.4)]'
								: 'text-zinc-400 hover:text-white hover:bg-white/5'}"
						>
							<span>🛠</span>
							<span>Consultation Services</span>
						</a>

						<a
							href="/dashboard/coupons"
							class="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all {$page.url.pathname.startsWith('/dashboard/coupons')
								? 'bg-indigo-600 text-white shadow-[0_0_16px_rgba(99,102,241,0.4)]'
								: 'text-zinc-400 hover:text-white hover:bg-white/5'}"
						>
							<span>🎟️</span>
							<span>Coupons & Discounts</span>
						</a>

						<a
							href="/dashboard/users"
							class="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all {$page.url.pathname.startsWith('/dashboard/users')
								? 'bg-indigo-600 text-white shadow-[0_0_16px_rgba(99,102,241,0.4)]'
								: 'text-zinc-400 hover:text-white hover:bg-white/5'}"
						>
							<span>👥</span>
							<span>Team & Experts Directory</span>
						</a>

						<a
							href="/dashboard/organization"
							class="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all {$page.url.pathname.startsWith('/dashboard/organization')
								? 'bg-indigo-600 text-white shadow-[0_0_16px_rgba(99,102,241,0.4)]'
								: 'text-zinc-400 hover:text-white hover:bg-white/5'}"
						>
							<span>🏢</span>
							<span>Organization Settings</span>
						</a>

						<a
							href="/dashboard/emails"
							class="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all {$page.url.pathname.startsWith('/dashboard/emails')
								? 'bg-indigo-600 text-white shadow-[0_0_16px_rgba(99,102,241,0.4)]'
								: 'text-zinc-400 hover:text-white hover:bg-white/5'}"
						>
							<span>✉️</span>
							<span>Email Templates</span>
						</a>
					</nav>
				</div>

				<!-- Quick Personal Links inside Org Mode -->
				<div class="pt-2 border-t border-white/5">
					<div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-3 mb-2">
						My Host Settings
					</div>
					<nav class="space-y-1">
						<a
							href="/dashboard/availability"
							class="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all {$page.url.pathname.startsWith('/dashboard/availability')
								? 'bg-white/10 text-white'
								: 'text-zinc-400 hover:text-white hover:bg-white/5'}"
						>
							<span>⏰</span>
							<span>Working Hours & Schedule</span>
						</a>

						<a
							href="/dashboard/calendars"
							class="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all {$page.url.pathname.startsWith('/dashboard/calendars')
								? 'bg-white/10 text-white'
								: 'text-zinc-400 hover:text-white hover:bg-white/5'}"
						>
							<div class="flex items-center gap-3">
								<span>🔗</span>
								<span>Calendar Sync</span>
							</div>
							{#if data.user?.googleConnected || data.user?.outlookConnected}
								<span class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
							{/if}
						</a>

						<a
							href="/dashboard/profile"
							class="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all {$page.url.pathname.startsWith('/dashboard/profile')
								? 'bg-white/10 text-white'
								: 'text-zinc-400 hover:text-white hover:bg-white/5'}"
						>
							<span>👤</span>
							<span>Profile & Bio</span>
						</a>
					</nav>
				</div>
			{:else}
				<!-- Personal Workspace Section (For All Members, or Admin in Personal Mode) -->
				<div>
					<div class="text-[10px] font-bold uppercase tracking-wider text-blue-400 px-3 mb-2 flex items-center justify-between">
						<span>My Personal Workspace</span>
						<span class="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold">
							Personal Focus
						</span>
					</div>
					<nav class="space-y-1">
						<a
							href="/dashboard?workspace=personal"
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
								<span>Google & Outlook Sync</span>
							</div>
							{#if data.user?.googleConnected || data.user?.outlookConnected}
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

					{#if data.isAdmin}
						<div class="mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/10 text-center">
							<p class="text-[11px] text-zinc-400 mb-2">Want to manage team services, coupons, or settings?</p>
							<button
								type="button"
								onclick={() => switchWorkspace('org')}
								class="w-full py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all flex items-center justify-center gap-1.5"
							>
								<span>🏢</span>
								<span>Switch to Org Workspace</span>
							</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- User Footer in Sidebar -->
		<div class="p-4 border-t border-white/10 bg-black/40 space-y-3">
			<div class="flex items-center space-x-3 min-w-0">
				{#if data.user?.profile_image}
					<img
						src={data.user.profile_image}
						alt={data.user?.name}
						class="w-10 h-10 rounded-full object-cover border border-white/20 shrink-0 shadow-md"
					/>
				{:else}
					<div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-sm shrink-0 border border-white/20 shadow-md">
						{data.user?.name?.charAt(0) || 'U'}
					</div>
				{/if}
				<div class="min-w-0 flex-1">
					<p class="text-xs font-bold text-white truncate">{data.user?.name}</p>
					<p class="text-[10px] text-zinc-400 truncate">{data.user?.email}</p>
					<span class="inline-block text-[9px] font-bold uppercase tracking-wider text-blue-400 mt-0.5">
						{roleBadgeLabel}
					</span>
				</div>
			</div>

			<!-- Prominent Sign Out Button -->
			<a
				href="/auth/logout"
				class="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 hover:border-red-500/40 transition-all flex items-center justify-center gap-2 group shadow-sm"
			>
				<span class="text-sm group-hover:scale-110 transition-transform">🚪</span>
				<span>Sign Out of Portal</span>
			</a>
		</div>
	</aside>

	<!-- Main Workspace View Area -->
	<div class="flex-1 min-w-0 flex flex-col bg-[#09090b]">
		{@render children()}
	</div>
</div>
