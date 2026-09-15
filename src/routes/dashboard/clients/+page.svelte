<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');
	let selectedClient = $state<any | null>(null);
	let activeTab = $state<'all' | 'multiple' | 'single'>('all');

	const clients = $derived(data.clients || []);

	const filteredClients = $derived(
		clients.filter((c: any) => {
			const matchesSearch =
				!searchQuery.trim() ||
				(c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
				(c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
				(c.phone && c.phone.includes(searchQuery));

			if (!matchesSearch) return false;

			if (activeTab === 'multiple') return c.totalSessions > 1;
			if (activeTab === 'single') return c.totalSessions === 1;
			return true;
		})
	);

	function formatDate(dateStr: string): string {
		try {
			const d = new Date(dateStr);
			return d.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			});
		} catch {
			return dateStr;
		}
	}

	function formatDateTime(dateStr: string): string {
		try {
			const d = new Date(dateStr);
			return d.toLocaleString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				hour12: true
			});
		} catch {
			return dateStr;
		}
	}
</script>

<svelte:head>
	<title>Clients Directory | Neubofy™ Expert CRM</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<div class="flex items-center gap-2.5">
				<h1 class="text-xl sm:text-2xl font-black text-white tracking-tight">Clients Directory</h1>
				<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/30">
					{data.workspaceMode === 'org' ? 'Organization Scope' : 'My Assigned Clients'}
				</span>
			</div>
			<p class="text-xs sm:text-sm text-zinc-400 mt-1">
				Complete records of all clients who have scheduled consultations across Neubofy.
			</p>
		</div>

		<div class="flex items-center gap-2">
			<span class="text-xs text-zinc-400 font-mono">
				Total Clients: <strong class="text-white">{data.totalClients}</strong>
			</span>
		</div>
	</div>

	<!-- Metric Quick Cards -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
		<div class="p-4 rounded-2xl bg-[#121216] border border-white/10">
			<div class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Total Clients</div>
			<div class="text-2xl font-black text-white mt-1">{data.totalClients}</div>
			<div class="text-[10px] text-zinc-500 mt-0.5">Verified consultation clients</div>
		</div>

		<div class="p-4 rounded-2xl bg-[#121216] border border-white/10">
			<div class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Total Sessions</div>
			<div class="text-2xl font-black text-indigo-400 mt-1">{data.totalBookings}</div>
			<div class="text-[10px] text-zinc-500 mt-0.5">Lifetime appointments booked</div>
		</div>

		<div class="p-4 rounded-2xl bg-[#121216] border border-white/10">
			<div class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Repeat Clients</div>
			<div class="text-2xl font-black text-emerald-400 mt-1">
				{clients.filter((c: any) => c.totalSessions > 1).length}
			</div>
			<div class="text-[10px] text-zinc-500 mt-0.5">Booked more than 1 session</div>
		</div>

		<div class="p-4 rounded-2xl bg-[#121216] border border-white/10">
			<div class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Auth Integration</div>
			<div class="text-2xl font-black text-amber-400 mt-1">Firebase</div>
			<div class="text-[10px] text-zinc-500 mt-0.5">Verified client authentication</div>
		</div>
	</div>

	<!-- Controls & Filter Toolbar -->
	<div class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
		<!-- Search Input -->
		<div class="relative flex-1 max-w-md">
			<span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">🔍</span>
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search by client name, email, or phone..."
				class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
			/>
		</div>

		<!-- Filter Tabs -->
		<div class="flex items-center p-1 rounded-xl bg-white/5 border border-white/10 self-start sm:self-auto">
			<button
				type="button"
				onclick={() => (activeTab = 'all')}
				class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all {activeTab === 'all'
					? 'bg-blue-600 text-white shadow-md'
					: 'text-zinc-400 hover:text-white'}"
			>
				All ({clients.length})
			</button>
			<button
				type="button"
				onclick={() => (activeTab = 'multiple')}
				class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all {activeTab === 'multiple'
					? 'bg-blue-600 text-white shadow-md'
					: 'text-zinc-400 hover:text-white'}"
			>
				Repeat Clients
			</button>
			<button
				type="button"
				onclick={() => (activeTab = 'single')}
				class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all {activeTab === 'single'
					? 'bg-blue-600 text-white shadow-md'
					: 'text-zinc-400 hover:text-white'}"
			>
				First-time
			</button>
		</div>
	</div>

	<!-- Clients Table -->
	{#if filteredClients.length === 0}
		<div class="p-12 text-center rounded-2xl bg-[#121216] border border-white/10">
			<div class="text-4xl mb-3">👥</div>
			<h3 class="text-base font-bold text-white">No clients found</h3>
			<p class="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
				{searchQuery ? 'Try adjusting your search query.' : 'When clients book consultations with your team, they will automatically appear in this directory.'}
			</p>
		</div>
	{:else}
		<div class="overflow-x-auto rounded-2xl border border-white/10 bg-[#121216]">
			<table class="w-full text-left text-xs text-zinc-300">
				<thead class="bg-white/[0.02] border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
					<tr>
						<th class="py-3 px-4">Client Name</th>
						<th class="py-3 px-4">Contact Info</th>
						<th class="py-3 px-4 text-center">Sessions</th>
						<th class="py-3 px-4">Last Consultation</th>
						<th class="py-3 px-4">Auth Status</th>
						<th class="py-3 px-4 text-right">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-white/5">
					{#each filteredClients as client}
						<tr class="hover:bg-white/[0.02] transition-colors">
							<td class="py-3.5 px-4">
								<div class="flex items-center gap-3">
									<div class="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
										{(client.name || 'C').charAt(0).toUpperCase()}
									</div>
									<div>
										<div class="font-bold text-white text-xs">{client.name}</div>
										{#if client.clientFirebaseUid}
											<div class="text-[10px] text-zinc-500 font-mono truncate max-w-[140px]" title={client.clientFirebaseUid}>
												UID: {client.clientFirebaseUid}
											</div>
										{/if}
									</div>
								</div>
							</td>
							<td class="py-3.5 px-4">
								<div class="text-xs font-mono text-zinc-300">{client.email}</div>
								{#if client.phone}
									<div class="text-[11px] text-zinc-400">{client.phone}</div>
								{/if}
							</td>
							<td class="py-3.5 px-4 text-center">
								<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold {client.totalSessions > 1 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-white/10 text-zinc-300'}">
									{client.totalSessions} {client.totalSessions === 1 ? 'session' : 'sessions'}
								</span>
							</td>
							<td class="py-3.5 px-4 font-mono text-zinc-400">
								{formatDate(client.lastSessionDate)}
							</td>
							<td class="py-3.5 px-4">
								{#if client.clientFirebaseUid}
									<span class="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
										<span>🔥</span>
										<span>Firebase User</span>
									</span>
								{:else}
									<span class="inline-flex items-center text-[10px] font-semibold text-zinc-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
										Guest
									</span>
								{/if}
							</td>
							<td class="py-3.5 px-4 text-right">
								<button
									type="button"
									onclick={() => (selectedClient = client)}
									class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 transition-all"
								>
									View History
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<!-- Client Details Modal / Drawer -->
	{#if selectedClient}
		<div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
			<div class="w-full max-w-2xl max-h-[90vh] bg-[#121216] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
				<!-- Modal Header -->
				<div class="p-5 border-b border-white/10 flex items-center justify-between bg-[#15151b]">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm">
							{(selectedClient.name || 'C').charAt(0).toUpperCase()}
						</div>
						<div>
							<h3 class="text-base font-black text-white">{selectedClient.name}</h3>
							<div class="text-xs text-zinc-400 font-mono">{selectedClient.email}</div>
						</div>
					</div>
					<button
						type="button"
						onclick={() => (selectedClient = null)}
						class="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors text-lg"
					>
						✕
					</button>
				</div>

				<!-- Modal Body (Client Profile & Sessions) -->
				<div class="p-5 overflow-y-auto space-y-5 flex-1">
					<!-- Client Stats Banner -->
					<div class="grid grid-cols-3 gap-2 text-center p-3 rounded-xl bg-white/[0.02] border border-white/10">
						<div>
							<div class="text-[10px] uppercase text-zinc-500 font-bold">Total Sessions</div>
							<div class="text-base font-black text-white mt-0.5">{selectedClient.totalSessions}</div>
						</div>
						<div>
							<div class="text-[10px] uppercase text-zinc-500 font-bold">Confirmed</div>
							<div class="text-base font-black text-emerald-400 mt-0.5">{selectedClient.confirmedCount}</div>
						</div>
						<div>
							<div class="text-[10px] uppercase text-zinc-500 font-bold">Canceled</div>
							<div class="text-base font-black text-zinc-400 mt-0.5">{selectedClient.canceledCount}</div>
						</div>
					</div>

					<!-- Sessions List -->
					<div>
						<h4 class="text-xs font-bold uppercase tracking-wider text-zinc-300 mb-3">
							Consultation Sessions History ({selectedClient.sessions.length})
						</h4>
						<div class="space-y-3">
							{#each selectedClient.sessions as session}
								<div class="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2.5">
									<div class="flex items-start justify-between gap-2">
										<div>
											<div class="font-bold text-white text-xs sm:text-sm">
												{session.eventName}
											</div>
											<div class="text-[11px] text-zinc-400 mt-0.5">
												Expert: <span class="text-blue-400 font-semibold">{session.expertName}</span>
											</div>
										</div>
										<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase {session.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}">
											{session.status}
										</span>
									</div>

									<div class="grid grid-cols-2 gap-2 text-xs font-mono pt-1 text-zinc-300">
										<div>
											<span class="text-zinc-500">Scheduled:</span> {formatDateTime(session.startTime)}
										</div>
										<div>
											<span class="text-zinc-500">Duration:</span> {session.durationMinutes} minutes
										</div>
									</div>

									{#if session.couponCode}
										<div class="text-[11px] text-emerald-400 font-medium">
											🎟️ Coupon Applied: <span class="font-mono font-bold">{session.couponCode}</span> (Total Paid: ₹{session.priceAmount})
										</div>
									{/if}

									{#if session.goal || session.reason || session.expectations || session.notes}
										<div class="pt-2 border-t border-white/5 text-xs space-y-1 bg-black/20 p-2.5 rounded-lg">
											{#if session.goal}
												<div><strong class="text-zinc-400">Goal:</strong> <span class="text-zinc-200">{session.goal}</span></div>
											{/if}
											{#if session.reason}
												<div><strong class="text-zinc-400">Reason:</strong> <span class="text-zinc-200">{session.reason}</span></div>
											{/if}
											{#if session.expectations}
												<div><strong class="text-zinc-400">Expectations:</strong> <span class="text-zinc-200">{session.expectations}</span></div>
											{/if}
											{#if session.notes}
												<div><strong class="text-zinc-400">Notes:</strong> <span class="text-zinc-200">{session.notes}</span></div>
											{/if}
										</div>
									{/if}

									{#if session.meetingUrl}
										<div class="pt-1 flex items-center justify-between">
											<a
												href={session.meetingUrl}
												target="_blank"
												class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 transition-colors shadow-sm"
											>
												<span>🎥</span>
												<span>Join Video Room</span>
											</a>
											<span class="text-[10px] text-zinc-500 font-mono">ID: {session.id.substring(0, 8)}...</span>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				</div>

				<!-- Modal Footer -->
				<div class="p-4 border-t border-white/10 bg-[#15151b] flex justify-end">
					<button
						type="button"
						onclick={() => (selectedClient = null)}
						class="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors"
					>
						Close
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
