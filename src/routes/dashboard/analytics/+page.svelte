<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatDate(iso: string) {
		const d = new Date(iso);
		return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function formatTime(iso: string) {
		const d = new Date(iso);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
	}
</script>

<svelte:head>
	<title>Analytics & Reports | Neubofy™</title>
</svelte:head>

<div class="p-6 sm:p-10 max-w-7xl mx-auto space-y-8 animate-fade-in">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">Analytics & Reports</h1>
			<p class="text-sm text-zinc-400 mt-1">
				Real-time KPIs, consultation volumes, and specialist workload tracking.
			</p>
		</div>

		<div class="flex items-center gap-2">
			<span class="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-zinc-300">
				Live Cloudflare D1 Data
			</span>
		</div>
	</div>

	<!-- 5 KPI Cards -->
	<div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
		<div class="glass-card rounded-2xl p-5 border border-white/10">
			<span class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Bookings</span>
			<div class="text-2xl sm:text-3xl font-bold text-white mt-2">
				{data.kpis.total}
			</div>
			<span class="text-[11px] text-zinc-400 mt-1 block">All-time consultations</span>
		</div>

		<div class="glass-card rounded-2xl p-5 border border-white/10">
			<span class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Upcoming</span>
			<div class="text-2xl sm:text-3xl font-bold text-blue-400 mt-2">
				{data.kpis.upcoming}
			</div>
			<span class="text-[11px] text-zinc-400 mt-1 block">Scheduled sessions</span>
		</div>

		<div class="glass-card rounded-2xl p-5 border border-white/10">
			<span class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Completed</span>
			<div class="text-2xl sm:text-3xl font-bold text-emerald-400 mt-2">
				{data.kpis.completed}
			</div>
			<span class="text-[11px] text-zinc-400 mt-1 block">Successfully held</span>
		</div>

		<div class="glass-card rounded-2xl p-5 border border-white/10">
			<span class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Hours Consulted</span>
			<div class="text-2xl sm:text-3xl font-bold text-amber-400 mt-2">
				{data.kpis.totalHours} hrs
			</div>
			<span class="text-[11px] text-zinc-400 mt-1 block">Total advisory time</span>
		</div>

		<div class="glass-card rounded-2xl p-5 border border-white/10 col-span-2 lg:col-span-1">
			<span class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Completion Rate</span>
			<div class="text-2xl sm:text-3xl font-bold text-purple-400 mt-2">
				{data.kpis.completionRate}%
			</div>
			<span class="text-[11px] text-zinc-400 mt-1 block">Attendance efficiency</span>
		</div>
	</div>

	<!-- 2-Column Section: Expert Workloads & Popular Services -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
		<!-- Expert Workload Breakdown (7 cols) -->
		<div class="lg:col-span-7 glass-card rounded-2xl p-6 sm:p-7 border border-white/10">
			<h2 class="text-lg font-bold text-white mb-1">Consultant Workload Distribution</h2>
			<p class="text-xs text-zinc-400 mb-6">Booking distribution and attendance per team member.</p>

			{#if data.expertStats && data.expertStats.length > 0}
				<div class="space-y-4">
					{#each data.expertStats as expert}
						{@const percentage = data.kpis.total > 0 ? Math.round((expert.total / data.kpis.total) * 100) : 0}
						<div class="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-3">
									{#if expert.profile_image}
										<img
											src={expert.profile_image}
											alt={expert.name}
											class="w-9 h-9 rounded-xl object-cover border border-white/10"
										/>
									{:else}
										<div class="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
											{expert.name?.charAt(0) || 'E'}
										</div>
									{/if}
									<div>
										<h3 class="text-xs font-bold text-white">{expert.name}</h3>
										<p class="text-[11px] text-zinc-400">{expert.role_title || 'Consultant'}</p>
									</div>
								</div>

								<div class="text-right">
									<span class="text-xs font-bold text-white">{expert.total} sessions</span>
									<span class="text-[10px] text-zinc-500 block">({percentage}% of total)</span>
								</div>
							</div>

							<!-- Visual Bar -->
							<div class="w-full bg-white/5 h-2 rounded-full overflow-hidden flex">
								<div
									class="bg-blue-500 h-full transition-all"
									style="width: {percentage}%"
								></div>
							</div>

							<div class="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
								<span>Upcoming: <strong class="text-blue-400">{expert.upcoming || 0}</strong></span>
								<span>Completed: <strong class="text-emerald-400">{expert.completed || 0}</strong></span>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="py-10 text-center text-xs text-zinc-500">
					No consultant booking records yet.
				</div>
			{/if}
		</div>

		<!-- Popular Services (5 cols) -->
		<div class="lg:col-span-5 glass-card rounded-2xl p-6 sm:p-7 border border-white/10 flex flex-col">
			<h2 class="text-lg font-bold text-white mb-1">Most Requested Services</h2>
			<p class="text-xs text-zinc-400 mb-6">Popularity by consultation category.</p>

			{#if data.popularServices && data.popularServices.length > 0}
				<div class="space-y-3 flex-1">
					{#each data.popularServices as service}
						<div class="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
							<div class="min-w-0 pr-3">
								<span class="text-[10px] uppercase font-bold text-blue-400 block mb-0.5">
									{service.category || 'Consulting'}
								</span>
								<h3 class="text-xs font-semibold text-white truncate">{service.name}</h3>
							</div>
							<div class="shrink-0 text-right">
								<span class="px-2.5 py-1 rounded-lg bg-white/5 text-xs font-bold text-white border border-white/10">
									{service.booking_count} booked
								</span>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="flex-1 flex items-center justify-center text-xs text-zinc-500">
					No consultation activity recorded yet.
				</div>
			{/if}
		</div>
	</div>

	<!-- Recent Activity Table -->
	<div class="glass-card rounded-2xl p-6 sm:p-7 border border-white/10">
		<h2 class="text-lg font-bold text-white mb-1">Recent Consultations</h2>
		<p class="text-xs text-zinc-400 mb-6">Chronological intake requests and scheduled meetings.</p>

		{#if data.recentBookings && data.recentBookings.length > 0}
			<div class="overflow-x-auto">
				<table class="w-full text-left text-xs">
					<thead class="text-zinc-500 uppercase tracking-wider border-b border-white/10">
						<tr>
							<th class="pb-3 font-semibold">Client</th>
							<th class="pb-3 font-semibold">Service</th>
							<th class="pb-3 font-semibold">Consultant</th>
							<th class="pb-3 font-semibold">Date & Time</th>
							<th class="pb-3 font-semibold">Goal / Intake</th>
							<th class="pb-3 font-semibold text-right">Status</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-white/5">
						{#each data.recentBookings as booking}
							<tr class="hover:bg-white/[0.02] transition-colors">
								<td class="py-3.5 pr-4">
									<div class="font-semibold text-white">{booking.attendee_name}</div>
									<div class="text-[11px] text-zinc-400">{booking.attendee_email}</div>
									{#if booking.attendee_phone}
										<div class="text-[10px] text-zinc-500">{booking.attendee_phone}</div>
									{/if}
								</td>
								<td class="py-3.5 pr-4">
									<div class="text-zinc-200 font-medium">{booking.service_name}</div>
									<span class="text-[10px] text-blue-400">{booking.service_category}</span>
								</td>
								<td class="py-3.5 pr-4 text-zinc-300 font-medium">
									{booking.expert_name}
								</td>
								<td class="py-3.5 pr-4">
									<div class="text-zinc-200">{formatDate(booking.start_time)}</div>
									<div class="text-[10px] text-zinc-500">{formatTime(booking.start_time)} ({booking.duration_minutes}m)</div>
								</td>
								<td class="py-3.5 pr-4 max-w-xs truncate text-zinc-400" title={booking.goal}>
									{booking.goal || 'No goal specified'}
								</td>
								<td class="py-3.5 text-right">
									<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide {booking.status === 'confirmed'
										? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
										: booking.status === 'canceled'
											? 'bg-red-500/15 text-red-400 border border-red-500/30'
											: 'bg-amber-500/15 text-amber-400 border border-amber-500/30'}">
										{booking.status}
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div class="py-8 text-center text-xs text-zinc-500">
				No consultation bookings have been made yet.
			</div>
		{/if}
	</div>
</div>
