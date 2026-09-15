<script lang="ts">
	import { createFormatters } from '$lib/utils/dateFormatters';

	interface Booking {
		id: string;
		event_type_name: string;
		event_type_slug: string;
		event_type_id: string;
		duration_minutes: number;
		attendee_name: string;
		attendee_email: string;
		attendee_phone?: string | null;
		start_time: string;
		end_time: string;
		status: string;
		attendee_notes?: string | null;
		canceled_by?: string | null;
		cancellation_reason?: string | null;
		final_price?: number;
		is_paid?: number;
		meeting_url?: string | null;
	}

	interface Props {
		bookings: Booking[];
		onCancelClick: (bookingId: string) => void;
		onRescheduleClick: (bookingId: string) => void;
		onDeleteClick: (booking: Booking) => void;
		pagination?: {
			page: number;
			pageSize: number;
			totalCount: number;
			totalPages: number;
		};
		onPageChange?: (page: number) => void;
	}

	let { bookings, onCancelClick, onRescheduleClick, onDeleteClick, pagination, onPageChange }: Props = $props();

	const { formatCompactDateTime } = createFormatters();

	let sortOrder = $state<'last_booked' | 'upcoming'>('last_booked');
	let statusFilter = $state<'all' | 'confirmed' | 'pending_payment' | 'canceled'>('all');

	const sortedBookings = $derived(() => {
		if (!bookings) return [];
		let filtered = [...bookings];

		if (statusFilter !== 'all') {
			filtered = filtered.filter((b) => {
				if (statusFilter === 'pending_payment') {
					return b.status === 'pending_payment' || (b.status === 'pending' && b.is_paid === 0);
				}
				return b.status === statusFilter;
			});
		}

		if (sortOrder === 'upcoming') {
			filtered.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
		}
		return filtered;
	});

	function getStatusColor(status: string) {
		switch (status) {
			case 'confirmed':
				return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
			case 'canceled':
				return 'bg-red-500/10 text-red-400 border border-red-500/20';
			case 'pending':
			case 'pending_payment':
				return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
			default:
				return 'bg-white/5 text-zinc-400 border border-white/10';
		}
	}
</script>

<div>
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
		<div>
			<h2 class="text-lg font-bold text-white tracking-tight">Consultation Sessions</h2>
			<p class="text-xs text-zinc-400">View and manage client consultations across all booking stages.</p>
		</div>

		<div class="flex items-center gap-2">
			<!-- Status Filter Tabs -->
			<div class="flex p-1 bg-black/40 border border-white/10 rounded-xl text-xs">
				<button
					type="button"
					onclick={() => (statusFilter = 'all')}
					class="px-2.5 py-1 rounded-lg transition font-medium {statusFilter === 'all'
						? 'bg-blue-600 text-white shadow-sm'
						: 'text-zinc-400 hover:text-white'}"
				>
					All ({bookings?.length || 0})
				</button>
				<button
					type="button"
					onclick={() => (statusFilter = 'confirmed')}
					class="px-2.5 py-1 rounded-lg transition font-medium {statusFilter === 'confirmed'
						? 'bg-emerald-600 text-white shadow-sm'
						: 'text-zinc-400 hover:text-white'}"
				>
					Confirmed
				</button>
				<button
					type="button"
					onclick={() => (statusFilter = 'pending_payment')}
					class="px-2.5 py-1 rounded-lg transition font-medium {statusFilter === 'pending_payment'
						? 'bg-amber-600 text-white shadow-sm'
						: 'text-zinc-400 hover:text-white'}"
				>
					Pending
				</button>
				<button
					type="button"
					onclick={() => (statusFilter = 'canceled')}
					class="px-2.5 py-1 rounded-lg transition font-medium {statusFilter === 'canceled'
						? 'bg-red-600 text-white shadow-sm'
						: 'text-zinc-400 hover:text-white'}"
				>
					Cancelled
				</button>
			</div>

			<select
				bind:value={sortOrder}
				class="text-xs border border-white/10 rounded-xl px-2.5 py-1.5 bg-white/5 text-zinc-300 focus:outline-none focus:border-blue-500"
			>
				<option value="last_booked" class="bg-[#121216] text-white">Latest</option>
				<option value="upcoming" class="bg-[#121216] text-white">Soonest</option>
			</select>
		</div>
	</div>

	<div class="space-y-3">
		{#if sortedBookings().length > 0}
			{#each sortedBookings() as booking}
				<div class="glass-card rounded-2xl p-4 border border-white/10 shadow-lg">
					<div class="flex justify-between items-start mb-2">
						<div>
							<div class="flex items-center gap-2">
								<h3 class="font-semibold text-white text-sm">{booking.event_type_name}</h3>
								{#if booking.final_price && booking.final_price > 0}
									{#if booking.is_paid === 1}
										<span class="px-2 py-0.2 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
											Paid ₹{booking.final_price}
										</span>
									{:else}
										<span class="px-2 py-0.2 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
											Pending UPI (₹{booking.final_price})
										</span>
									{/if}
								{/if}
							</div>
							<p class="text-xs text-zinc-300 mt-0.5">{booking.attendee_name}</p>
							<p class="text-xs text-zinc-500">{booking.attendee_email}</p>
						</div>
						<div class="flex items-center gap-2">
							<span class="px-2 py-0.5 text-xs rounded-full font-medium {getStatusColor(booking.status)}">
								{booking.status}
							</span>
							{#if booking.status === 'confirmed'}
								{#if booking.meeting_url}
									<a
										href={booking.meeting_url}
										target="_blank"
										rel="noopener noreferrer"
										class="text-xs text-emerald-400 hover:text-emerald-300 font-medium px-2 py-1 rounded-lg hover:bg-emerald-500/10 transition flex items-center gap-1"
									>
										<span>Join</span>
										<span class="text-[10px]">↗</span>
									</a>
								{/if}
								<button
									onclick={() => onRescheduleClick(booking.id)}
									class="text-xs text-blue-400 hover:text-blue-300 font-medium px-2 py-1 rounded-lg hover:bg-white/5 transition"
								>
									Reschedule
								</button>
								<button
									onclick={() => onCancelClick(booking.id)}
									class="text-xs text-red-400 hover:text-red-300 font-medium px-2 py-1 rounded-lg hover:bg-white/5 transition"
								>
									Cancel
								</button>
							{/if}
							{#if booking.status === 'canceled' || new Date(booking.end_time).getTime() <= Date.now() || booking.status === 'pending_payment'}
								<button
									onclick={() => onDeleteClick(booking)}
									class="text-xs font-medium text-zinc-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-white/5 transition"
									title="Move to Recycle Bin"
								>
									🗑️ Delete
								</button>
							{/if}
						</div>
					</div>
					<div class="text-xs text-zinc-300 mt-2 font-mono">
						<p>{formatCompactDateTime(new Date(booking.start_time))}</p>
					</div>
					{#if booking.attendee_notes}
						<div class="mt-3 text-xs text-zinc-300 bg-white/5 border border-white/10 rounded-xl p-3">
							<span class="font-medium text-zinc-400">Message:</span> {booking.attendee_notes}
						</div>
					{/if}
					{#if booking.status === 'canceled'}
						<div class="mt-3 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
							<span class="font-medium">Cancelled by {booking.canceled_by === 'host' ? 'you' : 'attendee'}</span>
							{#if booking.cancellation_reason}
								<span class="text-red-400/80">: {booking.cancellation_reason}</span>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		{:else}
			<div class="glass-card rounded-2xl p-8 text-center border border-white/10">
				<p class="text-sm text-zinc-400">No bookings yet</p>
			</div>
		{/if}

		{#if pagination && pagination.totalPages > 1}
			<div class="flex items-center justify-between p-4 bg-white/[0.02] border border-white/10 rounded-2xl text-xs text-zinc-400">
				<span>
					Showing <strong class="text-white">{(pagination.page - 1) * pagination.pageSize + 1}</strong>
					to <strong class="text-white">{Math.min(pagination.page * pagination.pageSize, pagination.totalCount)}</strong>
					of <strong class="text-white">{pagination.totalCount}</strong>
				</span>
				<div class="flex items-center gap-2">
					<button
						type="button"
						disabled={pagination.page <= 1}
						onclick={() => onPageChange && onPageChange(pagination.page - 1)}
						class="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
					>
						&larr; Prev
					</button>
					<span class="text-zinc-300">
						Page {pagination.page} / {pagination.totalPages}
					</span>
					<button
						type="button"
						disabled={pagination.page >= pagination.totalPages}
						onclick={() => onPageChange && onPageChange(pagination.page + 1)}
						class="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
					>
						Next &rarr;
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
