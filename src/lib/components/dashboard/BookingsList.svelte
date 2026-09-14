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
		start_time: string;
		end_time: string;
		status: string;
		attendee_notes?: string | null;
		canceled_by?: string | null;
		cancellation_reason?: string | null;
	}

	interface Props {
		bookings: Booking[];
		onCancelClick: (bookingId: string) => void;
		onRescheduleClick: (bookingId: string) => void;
		onDeleteClick: (booking: Booking) => void;
	}

	let { bookings, onCancelClick, onRescheduleClick, onDeleteClick }: Props = $props();

	const { formatCompactDateTime } = createFormatters();

	let sortOrder = $state<'last_booked' | 'upcoming'>('last_booked');

	const sortedBookings = $derived(() => {
		if (!bookings) return [];
		const sorted = [...bookings];
		if (sortOrder === 'upcoming') {
			// Sort by start_time ascending, showing soonest meeting first
			sorted.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
		}
		// 'last_booked' keeps the default order (already sorted by created_at DESC from server)
		return sorted;
	});

	function getStatusColor(status: string) {
		switch (status) {
			case 'confirmed':
				return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
			case 'canceled':
				return 'bg-red-500/10 text-red-400 border border-red-500/20';
			case 'pending':
				return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
			default:
				return 'bg-white/5 text-zinc-400 border border-white/10';
		}
	}
</script>

<div>
	<div class="flex justify-between items-center mb-4">
		<h2 class="text-lg font-bold text-white tracking-tight">Upcoming Bookings</h2>
		<select
			bind:value={sortOrder}
			class="text-xs border border-white/10 rounded-xl px-3 py-1.5 bg-white/5 text-zinc-300 focus:outline-none focus:border-blue-500"
		>
			<option value="last_booked" class="bg-[#121216] text-white">Last booked</option>
			<option value="upcoming" class="bg-[#121216] text-white">Upcoming first</option>
		</select>
	</div>

	<div class="space-y-3">
		{#if sortedBookings().length > 0}
			{#each sortedBookings() as booking}
				<div class="glass-card rounded-2xl p-4 border border-white/10 shadow-lg">
					<div class="flex justify-between items-start mb-2">
						<div>
							<h3 class="font-semibold text-white text-sm">{booking.event_type_name}</h3>
							<p class="text-xs text-zinc-300 mt-0.5">{booking.attendee_name}</p>
							<p class="text-xs text-zinc-500">{booking.attendee_email}</p>
						</div>
						<div class="flex items-center gap-2">
							<span class="px-2 py-0.5 text-xs rounded-full font-medium {getStatusColor(booking.status)}">
								{booking.status}
							</span>
							{#if booking.status === 'confirmed'}
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
							{#if booking.status === 'canceled' || new Date(booking.end_time).getTime() <= Date.now()}
								<button
									onclick={() => onDeleteClick(booking)}
									class="text-xs font-medium text-red-400/80 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-white/5 transition"
								>
									Delete
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
	</div>
</div>
