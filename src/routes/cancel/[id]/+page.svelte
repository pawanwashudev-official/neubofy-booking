<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import type { PageData, ActionData } from './$types';
	import Footer from '$lib/components/Footer.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let cancelling = $state(false);
	let reason = $state('');
	const success = $derived($page.url.searchParams.get('success') === 'true');

	// Email Verification State
	let enteredEmail = $state('');
	let otpCode = $state('');
	let otpSent = $state(false);
	let sendingOtp = $state(false);
	let verifyingOtp = $state(false);
	let isVerified = $state(false);
	let verificationToken = $state('');
	let otpError = $state('');
	let otpSuccess = $state('');

	function formatDateTime(dateStr: string) {
		const date = new Date(dateStr);
		return new Intl.DateTimeFormat('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		}).format(date);
	}

	async function handleSendOtp() {
		if (!enteredEmail || !enteredEmail.includes('@')) {
			otpError = 'Please enter a valid email address.';
			return;
		}
		otpError = '';
		otpSuccess = '';
		sendingOtp = true;

		try {
			const res = await fetch('/api/otp/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: enteredEmail, purpose: 'cancel' })
			});
			const result = await res.json() as { success?: boolean; message?: string };
			if (!res.ok) {
				otpError = result.message || 'Failed to send verification code.';
			} else {
				otpSent = true;
				otpSuccess = 'Verification code sent to your email!';
			}
		} catch (err) {
			otpError = 'Network error while sending verification code.';
		} finally {
			sendingOtp = false;
		}
	}

	async function handleVerifyOtp() {
		if (!otpCode || otpCode.trim().length !== 6) {
			otpError = 'Please enter the 6-digit verification code.';
			return;
		}
		otpError = '';
		otpSuccess = '';
		verifyingOtp = true;

		try {
			const res = await fetch('/api/otp/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: enteredEmail, code: otpCode.trim(), purpose: 'cancel' })
			});
			const result = await res.json() as { success?: boolean; verifiedToken?: string; message?: string };
			if (!res.ok || !result.verifiedToken) {
				otpError = result.message || 'Invalid or expired code.';
			} else {
				verificationToken = result.verifiedToken;
				isVerified = true;
				otpSuccess = 'Email verified successfully!';
			}
		} catch (err) {
			otpError = 'Network error while verifying code.';
		} finally {
			verifyingOtp = false;
		}
	}

	function handleSubmit() {
		cancelling = true;
		return async ({ update }: any) => {
			await update();
			cancelling = false;
		};
	}
</script>

<svelte:head>
	<title>Cancel Booking</title>
</svelte:head>

<div class="min-h-screen bg-[#09090b] text-zinc-100 py-12 px-4 flex items-center justify-center">
	<div class="max-w-xl w-full mx-auto space-y-6 animate-fade-in">
		{#if success || data.alreadyCanceled}
			<!-- Success Message -->
			<div class="glass-card rounded-3xl border border-white/10 p-8 sm:p-10 text-center shadow-2xl space-y-4">
				<div class="w-16 h-16 bg-red-500/15 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto text-2xl">
					✕
				</div>
				<h1 class="text-2xl font-bold text-white tracking-tight">Booking Cancelled</h1>
				<p class="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-md mx-auto">
					Your consultation has been successfully cancelled and the specialist has been notified.
				</p>
				<div class="pt-4">
					<a
						href="/"
						class="btn-electric px-6 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-[0_0_20px_rgba(59,130,246,0.4)]"
					>
						<span>← Return to Consultation Portal</span>
					</a>
				</div>
			</div>
		{:else}
			<!-- Cancellation Form -->
			<div class="glass-card rounded-3xl border border-white/10 p-8 sm:p-10 shadow-2xl space-y-6">
				<div class="border-b border-white/10 pb-4">
					<span class="text-[10px] font-bold uppercase tracking-wider text-red-400 px-2.5 py-0.5 rounded bg-red-500/15 border border-red-500/30">
						Cancellation Request
					</span>
					<h1 class="text-2xl font-bold text-white tracking-tight mt-2">Cancel Consultation</h1>
					<p class="text-xs text-zinc-400 mt-1">Please verify your email address to release your reserved time slot.</p>
				</div>

				{#if form?.error}
					<div class="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold">
						✕ {form.error}
					</div>
				{/if}

				<div class="p-5 rounded-2xl bg-black/40 border border-white/10 space-y-2.5 text-xs">
					<h2 class="font-bold text-white text-sm mb-3">Consultation Details</h2>
					<div class="flex justify-between py-1 border-b border-white/5">
						<span class="text-zinc-400">Service:</span>
						<span class="text-white font-semibold">{data.booking.event_name}</span>
					</div>
					<div class="flex justify-between py-1 border-b border-white/5">
						<span class="text-zinc-400">Specialist:</span>
						<span class="text-white font-semibold">{data.booking.host_name}</span>
					</div>
					<div class="flex justify-between py-1 border-b border-white/5">
						<span class="text-zinc-400">Scheduled Time:</span>
						<span class="text-white font-semibold">{formatDateTime(data.booking.start_time)}</span>
					</div>
					<div class="flex justify-between py-1">
						<span class="text-zinc-400">Client:</span>
						<span class="text-white font-semibold">{data.booking.attendee_name}</span>
					</div>
				</div>

				<!-- Identity Verification Step -->
				<div class="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
					<div class="flex items-center justify-between">
						<h3 class="text-xs font-bold uppercase tracking-wider text-zinc-300">
							Step 1: Verify Attendee Email
						</h3>
						{#if isVerified}
							<span class="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
								✓ Verified
							</span>
						{/if}
					</div>

					<p class="text-xs text-zinc-400">
						Please verify the email address associated with this booking ({data.maskedEmail}):
					</p>

					{#if !isVerified}
						<div class="space-y-3">
							<div class="flex gap-2">
								<input
									type="email"
									bind:value={enteredEmail}
									disabled={otpSent}
									placeholder="Enter your full email address"
									class="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
								/>
								{#if !otpSent}
									<button
										type="button"
										onclick={handleSendOtp}
										disabled={sendingOtp}
										class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
									>
										{sendingOtp ? 'Sending...' : 'Send OTP'}
									</button>
								{:else}
									<button
										type="button"
										onclick={() => { otpSent = false; otpCode = ''; }}
										class="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold"
									>
										Change
									</button>
								{/if}
							</div>

							{#if otpSent}
								<div class="flex gap-2 animate-fade-in">
									<input
										type="text"
										maxlength="6"
										bind:value={otpCode}
										placeholder="6-digit code"
										class="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-blue-500/50 text-xs font-mono tracking-widest text-center text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
									/>
									<button
										type="button"
										onclick={handleVerifyOtp}
										disabled={verifyingOtp}
										class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
									>
										{verifyingOtp ? 'Verifying...' : 'Verify'}
									</button>
								</div>
							{/if}

							{#if otpError}
								<div class="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
									{otpError}
								</div>
							{/if}
							{#if otpSuccess}
								<div class="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg">
									{otpSuccess}
								</div>
							{/if}
						</div>
					{:else}
						<div class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
							<span>Identity confirmed for <strong>{enteredEmail}</strong></span>
							<span class="text-xs">✓ Ready to cancel</span>
						</div>
					{/if}
				</div>

				<!-- Cancellation Confirmation Step -->
				<form method="POST" use:enhance={handleSubmit} class="space-y-4">
					<input type="hidden" name="email" value={enteredEmail} />
					<input type="hidden" name="verificationToken" value={verificationToken} />

					<div>
						<label for="reason" class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
							Step 2: Reason for cancellation (optional)
						</label>
						<textarea
							id="reason"
							name="reason"
							bind:value={reason}
							disabled={!isVerified}
							rows="3"
							class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all resize-none disabled:opacity-40"
							placeholder={isVerified ? "Let the specialist know why you're cancelling..." : "Please verify your email above first..."}
						></textarea>
					</div>

					<div class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2.5">
						<span class="text-base">⚠️</span>
						<span>This action will cancel the meeting calendar invite and notify the specialist.</span>
					</div>

					<div class="flex flex-col sm:flex-row gap-3 pt-2">
						<button
							type="submit"
							disabled={cancelling || !isVerified}
							class="flex-1 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_16px_rgba(239,68,68,0.4)] disabled:opacity-40 disabled:cursor-not-allowed"
						>
							{cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
						</button>
						<a
							href="/"
							class="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 text-xs font-semibold text-center transition-all"
						>
							Keep Consultation
						</a>
					</div>
				</form>
			</div>
		{/if}
	</div>
</div>
