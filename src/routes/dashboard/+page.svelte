<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Reactive bookings
	let bookings = $state<any[]>(data.recentBookings || []);
	let filterStatus = $state<'upcoming' | 'completed' | 'canceled' | 'all'>('upcoming');

	// Active intake modal
	let activeIntakeBooking = $state<any | null>(null);

	// Cancellation modal
	let cancellingBookingId = $state<string | null>(null);
	let cancelReason = $state<string>('');
	let cancelling = $state<boolean>(false);
	let cancelSuccess = $state<string>('');
	let cancelError = $state<string>('');

	// Filtered bookings
	const now = new Date().getTime();
	const filteredBookings = $derived(
		bookings.filter((b) => {
			const start = new Date(b.start_time).getTime();
			if (filterStatus === 'upcoming') return b.status === 'confirmed' && start > now;
			if (filterStatus === 'completed') return b.status === 'confirmed' && start <= now;
			if (filterStatus === 'canceled') return b.status === 'canceled';
			return true;
		})
	);

	function formatDate(iso: string) {
		const d = new Date(iso);
		return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
	}

	function formatTime(iso: string) {
		const d = new Date(iso);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
	}

	function openCancelModal(id: string) {
		cancellingBookingId = id;
		cancelReason = '';
		cancelError = '';
	}

	function closeCancelModal() {
		cancellingBookingId = null;
		cancelReason = '';
	}

	async function submitCancelBooking() {
		if (!cancellingBookingId) return;
		cancelling = true;
		cancelError = '';

		try {
			const res = await fetch('/api/bookings/cancel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					bookingId: cancellingBookingId,
					reason: cancelReason.trim() || 'Canceled by host'
				})
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.message || 'Failed to cancel appointment');

			bookings = bookings.map((b) => (b.id === cancellingBookingId ? { ...b, status: 'canceled' } : b));
			cancelSuccess = 'Appointment canceled successfully.';
			closeCancelModal();
			setTimeout(() => (cancelSuccess = ''), 4000);
		} catch (err: any) {
			cancelError = err.message || 'Error canceling appointment.';
		} finally {
			cancelling = false;
		}
	}
</script>

<svelte:head>
	<title>Consultations & Appointments | Neubofy™</title>
</svelte:head>

<div class="p-6 sm:p-10 max-w-7xl mx-auto space-y-8 animate-fade-in">
	<!-- Workspace Topbar -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">
				{data.canManageOrganization ? 'Organization Consultations' : 'My Appointments'}
			</h1>
			<p class="text-sm text-zinc-400 mt-1">
				Manage scheduled strategy sessions, join Google Meet rooms, and review client intake data.
			</p>
		</div>

		<div class="flex items-center gap-3">
			<a
				href="/"
				target="_blank"
				class="btn-electric px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2"
			>
				<span>+ New Booking</span>
				<span>↗</span>
			</a>
		</div>
	</div>

	{#if cancelSuccess}
		<div class="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
			✓ {cancelSuccess}
		</div>
	{/if}

	<!-- Status Filter Tabs -->
	<div class="flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
		<button
			type="button"
			onclick={() => (filterStatus = 'upcoming')}
			class="px-4 py-2 rounded-xl text-xs font-semibold transition-all {filterStatus === 'upcoming'
				? 'bg-blue-600 text-white shadow-[0_0_16px_rgba(37,99,235,0.4)]'
				: 'bg-white/5 text-zinc-400 hover:text-white border border-white/10'}"
		>
			Upcoming ({bookings.filter((b) => b.status === 'confirmed' && new Date(b.start_time).getTime() > now).length})
		</button>

		<button
			type="button"
			onclick={() => (filterStatus = 'completed')}
			class="px-4 py-2 rounded-xl text-xs font-semibold transition-all {filterStatus === 'completed'
				? 'bg-blue-600 text-white shadow-[0_0_16px_rgba(37,99,235,0.4)]'
				: 'bg-white/5 text-zinc-400 hover:text-white border border-white/10'}"
		>
			Completed ({bookings.filter((b) => b.status === 'confirmed' && new Date(b.start_time).getTime() <= now).length})
		</button>

		<button
			type="button"
			onclick={() => (filterStatus = 'canceled')}
			class="px-4 py-2 rounded-xl text-xs font-semibold transition-all {filterStatus === 'canceled'
				? 'bg-blue-600 text-white shadow-[0_0_16px_rgba(37,99,235,0.4)]'
				: 'bg-white/5 text-zinc-400 hover:text-white border border-white/10'}"
		>
			Canceled ({bookings.filter((b) => b.status === 'canceled').length})
		</button>

		<button
			type="button"
			onclick={() => (filterStatus = 'all')}
			class="px-4 py-2 rounded-xl text-xs font-semibold transition-all {filterStatus === 'all'
				? 'bg-blue-600 text-white shadow-[0_0_16px_rgba(37,99,235,0.4)]'
				: 'bg-white/5 text-zinc-400 hover:text-white border border-white/10'}"
		>
			All ({bookings.length})
		</button>
	</div>

	<!-- Consultations List -->
	{#if filteredBookings.length > 0}
		<div class="space-y-4">
			{#each filteredBookings as booking}
				<div class="glass-card rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6">
					<div class="space-y-3 flex-1 min-w-0">
						<!-- Service Badge & Date -->
						<div class="flex flex-wrap items-center gap-2">
							<span class="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
								{booking.service_category || 'Consultation'}
							</span>
							<span class="text-xs text-zinc-400 font-medium">
								{formatDate(booking.start_time)} &bull; {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
							</span>
							<span class="text-xs text-zinc-500">
								({booking.duration_minutes || 30} mins)
							</span>
							<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase {booking.status === 'confirmed'
								? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
								: 'bg-red-500/15 text-red-400 border border-red-500/30'}">
								{booking.status}
							</span>
						</div>

						<!-- Service Title -->
						<h3 class="text-lg font-bold text-white leading-snug">
							{booking.event_type_name}
						</h3>

						<!-- Client & Host Info -->
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-300">
							<div>
								<span class="text-zinc-500">Client:</span> <strong class="text-white">{booking.attendee_name}</strong>
								<span class="text-zinc-400">({booking.attendee_email})</span>
								{#if booking.attendee_phone}
									<span class="block text-zinc-400 mt-0.5">📞 {booking.attendee_phone}</span>
								{/if}
							</div>
							<div>
								<span class="text-zinc-500">Consultant:</span> <strong class="text-white">{booking.expert_name}</strong>
								<span class="text-zinc-400 block mt-0.5">{booking.expert_role || 'Technology Lead'}</span>
							</div>
						</div>

						<!-- Snippet of Goal -->
						{#if booking.goal}
							<div class="text-xs text-zinc-400 bg-white/[0.02] p-2.5 rounded-lg border border-white/5 line-clamp-2">
								<strong class="text-zinc-300">Client Goal:</strong> {booking.goal}
							</div>
						{/if}
					</div>

					<!-- Actions -->
					<div class="flex flex-wrap lg:flex-col items-end gap-2 shrink-0">
						{#if booking.meeting_url && booking.status === 'confirmed'}
							<a
								href={booking.meeting_url}
								target="_blank"
								rel="noreferrer"
								class="btn-electric px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-[0_0_16px_rgba(37,99,235,0.4)]"
							>
								<span>📹 Join Google Meet</span>
								<span>↗</span>
							</a>
						{/if}

						<button
							type="button"
							onclick={() => (activeIntakeBooking = booking)}
							class="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 transition-all"
						>
							View Intake Answers
						</button>

						{#if booking.status === 'confirmed'}
							<button
								type="button"
								onclick={() => openCancelModal(booking.id)}
								class="px-4 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-all"
							>
								Cancel Session
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="glass-card rounded-2xl p-12 text-center border border-white/10">
			<div class="w-12 h-12 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 text-xl">
				📅
			</div>
			<h3 class="text-base font-bold text-white">No Consultations Found</h3>
			<p class="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
				There are no {filterStatus} appointments matching this filter.
			</p>
		</div>
	{/if}
</div>

<!-- Client Intake Questionnaire Modal -->
{#if activeIntakeBooking}
	<div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
		<div class="glass-card w-full max-w-lg rounded-2xl p-6 sm:p-7 border border-white/15 space-y-5 animate-fade-in">
			<div class="flex items-center justify-between pb-3 border-b border-white/10">
				<div>
					<span class="text-[10px] uppercase font-bold text-blue-400">Client Intake Questionnaire</span>
					<h3 class="text-base font-bold text-white">{activeIntakeBooking.attendee_name}</h3>
				</div>
				<button
					type="button"
					onclick={() => (activeIntakeBooking = null)}
					class="text-zinc-400 hover:text-white text-lg p-1"
				>
					✕
				</button>
			</div>

			<div class="space-y-4 text-xs">
				<div class="p-3 rounded-xl bg-white/[0.02] border border-white/5">
					<span class="font-bold text-zinc-300 block mb-1">1. Primary Business / Technical Goal</span>
					<p class="text-zinc-400 leading-relaxed">{activeIntakeBooking.goal || 'Not provided'}</p>
				</div>

				<div class="p-3 rounded-xl bg-white/[0.02] border border-white/5">
					<span class="font-bold text-zinc-300 block mb-1">2. Why Consultation Right Now</span>
					<p class="text-zinc-400 leading-relaxed">{activeIntakeBooking.reason || 'Not provided'}</p>
				</div>

				<div class="p-3 rounded-xl bg-white/[0.02] border border-white/5">
					<span class="font-bold text-zinc-300 block mb-1">3. Key Expectations From Expert</span>
					<p class="text-zinc-400 leading-relaxed">{activeIntakeBooking.expectations || 'Not provided'}</p>
				</div>

				{#if activeIntakeBooking.attendee_notes}
					<div class="p-3 rounded-xl bg-white/[0.02] border border-white/5">
						<span class="font-bold text-zinc-300 block mb-1">Additional Notes</span>
						<p class="text-zinc-400 leading-relaxed">{activeIntakeBooking.attendee_notes}</p>
					</div>
				{/if}
			</div>

			<div class="flex justify-end pt-3 border-t border-white/10">
				<button
					type="button"
					onclick={() => (activeIntakeBooking = null)}
					class="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Cancellation Modal -->
{#if cancellingBookingId}
	<div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
		<div class="glass-card w-full max-w-md rounded-2xl p-6 border border-white/15 space-y-4 animate-fade-in">
			<h3 class="text-base font-bold text-white">Cancel Consultation</h3>
			<p class="text-xs text-zinc-400">
				Are you sure you want to cancel this appointment? The client and expert will be notified via email.
			</p>

			<div>
				<label for="cancel-reason" class="block text-xs font-semibold text-zinc-400 mb-1">
					Reason for Cancellation (Optional)
				</label>
				<textarea
					id="cancel-reason"
					bind:value={cancelReason}
					rows={3}
					placeholder="e.g. Rescheduling required due to technical emergency..."
					class="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs outline-none focus:border-red-500"
				></textarea>
			</div>

			{#if cancelError}
				<p class="text-xs text-red-400">{cancelError}</p>
			{/if}

			<div class="flex justify-end gap-2 pt-2 border-t border-white/10">
				<button
					type="button"
					onclick={closeCancelModal}
					class="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
				>
					Keep Appointment
				</button>
				<button
					type="button"
					disabled={cancelling}
					onclick={submitCancelBooking}
					class="px-5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
				>
					{cancelling ? 'Canceling...' : 'Confirm Cancellation'}
				</button>
			</div>
		</div>
	</div>
{/if}
