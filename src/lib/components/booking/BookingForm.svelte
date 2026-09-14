<script lang="ts">
	interface Props {
		bookingForm: {
			name: string;
			email: string;
			notes: string;
		};
		bookingStatus: 'idle' | 'submitting' | 'success' | 'error';
		bookingError: string;
		brandColor: string;
		brandDark: string;
		onSubmit: (e: Event) => void;
	}

	let {
		bookingForm = $bindable(),
		bookingStatus,
		bookingError,
		brandColor,
		brandDark,
		onSubmit
	}: Props = $props();
</script>

<div class="max-w-md space-y-6">
	<h2 class="text-xl font-bold text-white tracking-tight">Enter Consultation Details</h2>

	{#if bookingError}
		<div class="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold">
			✕ {bookingError}
		</div>
	{/if}

	<form onsubmit={onSubmit} class="space-y-4">
		<div>
			<label for="name" class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">Full Name *</label>
			<input
				type="text"
				id="name"
				bind:value={bookingForm.name}
				required
				class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all"
			/>
		</div>
		<div>
			<label for="email" class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">Email Address *</label>
			<input
				type="email"
				id="email"
				bind:value={bookingForm.email}
				required
				class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all"
			/>
		</div>
		<div>
			<label for="notes" class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
				Session Agenda / Requirements (Optional)
			</label>
			<textarea
				id="notes"
				bind:value={bookingForm.notes}
				rows="4"
				placeholder="Describe your goals or topics you would like to discuss..."
				class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all resize-none"
			></textarea>
		</div>
		<button
			type="submit"
			disabled={bookingStatus === 'submitting'}
			class="w-full btn-electric py-3 px-6 rounded-xl font-bold text-xs sm:text-sm shadow-[0_0_24px_rgba(59,130,246,0.4)] transition disabled:opacity-50"
		>
			{bookingStatus === 'submitting' ? 'Scheduling Meeting...' : 'Confirm & Schedule Consultation →'}
		</button>
	</form>
</div>
