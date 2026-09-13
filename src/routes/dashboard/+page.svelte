<script lang="ts">
	import type { PageData } from './$types';
	import { ProfileSection, CancelBookingModal, HostRescheduleModal, BookingsList, EventTypesList } from '$lib/components/dashboard';

	let { data }: { data: PageData } = $props();

	// Local reactive copy of bookings for UI updates
	let bookings = $state(data.recentBookings || []);
	let eventTypes = $state(data.eventTypes || []);

	// Cancel booking state
	let cancellingBookingId = $state<string | null>(null);
	let showCancelModal = $state(false);
	let cancelSuccess = $state('');
	let deletionSuccess = $state('');

	// Reschedule booking state
	let reschedulingBookingId = $state<string | null>(null);
	let rescheduleSuccess = $state('');

	async function deleteEventType(eventType: { id: string; name: string }) {
		if (!confirm(`Delete ${eventType.name} and its bookings? This cannot be undone.`)) return;
		const confirmation = prompt(`Type ${eventType.name} to confirm deletion.`);
		if (confirmation !== eventType.name) return;
		const response = await fetch(`/api/event-type/${eventType.slug}`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ confirmation })
		});
		if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { message?: string }).message || 'Failed to delete event type');
		eventTypes = eventTypes.filter((item) => item.id !== eventType.id);
		deletionSuccess = `${eventType.name} was deleted.`;
	}

	async function deleteBooking(booking: { id: string; attendee_name: string }) {
		if (!confirm(`Delete this booking for ${booking.attendee_name}? This cannot be undone.`)) return;
		const confirmation = prompt(`Type ${booking.attendee_name} to confirm deletion.`);
		if (confirmation !== booking.attendee_name) return;
		const response = await fetch('/api/bookings/delete', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ bookingId: booking.id, confirmation })
		});
		if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { message?: string }).message || 'Failed to delete booking');
		bookings = bookings.filter((item) => item.id !== booking.id);
		deletionSuccess = 'Booking was deleted.';
	}

	async function deleteOrganization() {
		if (!data.organization?.name) return;
		if (!confirm('Delete the complete organization and all users, bookings, event types, calendars, and settings? This cannot be undone.')) return;
		const confirmation = prompt(`Type ${data.organization.name} to permanently delete it.`);
		if (confirmation !== data.organization.name) return;
		const response = await fetch('/api/organization/delete', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ confirmation })
		});
		if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { message?: string }).message || 'Failed to delete organization');
		window.location.href = '/';
	}

	function openCancelModal(bookingId: string) {
		cancellingBookingId = bookingId;
		showCancelModal = true;
	}

	function closeCancelModal() {
		showCancelModal = false;
		cancellingBookingId = null;
	}

	async function cancelBooking(message: string) {
		if (!cancellingBookingId) return;

		const response = await fetch('/api/bookings/cancel', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				bookingId: cancellingBookingId,
				message: message || null
			})
		});

		if (!response.ok) {
			const errData = await response.json() as { message?: string };
			throw new Error(errData.message || 'Failed to cancel booking');
		}

		// Update local reactive state for immediate UI update
		bookings = bookings.map(b =>
			b.id === cancellingBookingId
				? { ...b, status: 'canceled' }
				: b
		);

		cancelSuccess = 'Booking cancelled successfully';
		closeCancelModal();
		setTimeout(() => cancelSuccess = '', 3000);
	}

	function getBookingById(bookingId: string | null) {
		if (!bookingId) return null;
		return bookings.find(b => b.id === bookingId) || null;
	}

	// Reschedule functions
	function openRescheduleModal(bookingId: string) {
		reschedulingBookingId = bookingId;
	}

	function closeRescheduleModal() {
		reschedulingBookingId = null;
	}

	async function submitRescheduleProposal(bookingId: string, newStartTime: string, newEndTime: string, message: string) {
		const response = await fetch('/api/bookings/propose-reschedule', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				bookingId,
				proposedStartTime: newStartTime,
				proposedEndTime: newEndTime,
				message: message || null
			})
		});

		if (!response.ok) {
			const errData = await response.json() as { message?: string };
			throw new Error(errData.message || 'Failed to send reschedule proposal');
		}

		// Update local state - mark as pending reschedule
		bookings = bookings.map(b =>
			b.id === bookingId
				? { ...b, status: 'rescheduled' }
				: b
		);

		rescheduleSuccess = 'Reschedule proposal sent to attendee';
		closeRescheduleModal();
		setTimeout(() => rescheduleSuccess = '', 3000);
	}
</script>

<div class="min-h-screen bg-gray-50">
	<!-- Header -->
	<header class="bg-white shadow-sm">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
			<div class="flex justify-between items-center">
				<div>
					<h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
					<p class="text-sm text-gray-600">Welcome back, {data.user?.name || 'User'}!</p>
				</div>
				<div class="flex gap-4">
					<a
						href="/dashboard/users"
						class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
					>
						Users
					</a>
					<a
						href="/dashboard/calendars"
						class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
					>
						Calendars
					</a>
					<a
						href="/dashboard/emails"
						class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
					>
						Emails
					</a>
					<a
						href="/dashboard/availability"
						class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
					>
						Set Availability
					</a>
					<form method="POST" action="/auth/logout">
						<button
							type="submit"
							class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
						>
							Logout
						</button>
					</form>
				</div>
			</div>
		</div>
	</header>

	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<!-- Profile Section -->
		<ProfileSection user={data.user} />

		<!-- Booking Link -->
		<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
			<h2 class="text-lg font-semibold text-blue-900 mb-2">Your Booking Page</h2>
			<div class="flex items-center gap-2">
				<input
					type="text"
					readonly
					value="{data.appUrl}/"
					class="flex-1 px-3 py-2 bg-white border border-blue-300 rounded-md text-sm"
				/>
				<button
					onclick={() => {
						navigator.clipboard.writeText(data.appUrl + '/');
					}}
					class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm"
				>
					Copy Link
				</button>
			</div>
		</div>

		{#if cancelSuccess || rescheduleSuccess}
			<div class="bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-sm mb-4">
				{cancelSuccess || rescheduleSuccess}
			</div>
		{/if}

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
			<!-- Event Types -->
					<EventTypesList {eventTypes} onDeleteClick={deleteEventType} />

			<!-- Recent Bookings -->
					<BookingsList {bookings} onCancelClick={openCancelModal} onRescheduleClick={openRescheduleModal} onDeleteClick={deleteBooking} />
		</div>

				{#if deletionSuccess}
					<div class="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{deletionSuccess}</div>
				{/if}

				{#if data.role === 'owner'}
					<section class="mt-10 rounded-xl border border-red-200 bg-red-50 p-5">
						<h2 class="font-semibold text-red-900">Danger zone</h2>
						<p class="mt-1 text-sm text-red-800">Permanently delete {data.organization?.name || 'this organization'} and every record inside it.</p>
						<button onclick={deleteOrganization} class="mt-4 rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800">Delete organization</button>
					</section>
				{/if}
	</main>
</div>

<!-- Cancel Booking Modal -->
<CancelBookingModal
	booking={getBookingById(cancellingBookingId)}
	show={showCancelModal}
	onClose={closeCancelModal}
	onCancel={cancelBooking}
/>

<!-- Host Reschedule Modal -->
<HostRescheduleModal
	booking={getBookingById(reschedulingBookingId)}
	onClose={closeRescheduleModal}
	onSubmit={submitRescheduleProposal}
/>
