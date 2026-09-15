<script lang="ts">
	import { onMount } from 'svelte';
	import {
		clientUser,
		clientAuthLoading,
		getFirebaseAuth,
		signInWithGoogle,
		signInWithEmail,
		signUpWithEmail,
		signOutClient
	} from '$lib/firebase/client';

	let authMode = $state<'login' | 'signup'>('login');
	let emailInput = $state('');
	let passwordInput = $state('');
	let nameInput = $state('');
	let authError = $state('');
	let authSubmitting = $state(false);

	let bookings = $state<any[]>([]);
	let loadingBookings = $state(false);
	let activeTab = $state<'upcoming' | 'past'>('upcoming');

	onMount(() => {
		getFirebaseAuth();
	});

	// Reactively fetch client bookings whenever clientUser updates
	$effect(() => {
		if ($clientUser?.uid || $clientUser?.email) {
			fetchClientBookings();
		} else {
			bookings = [];
		}
	});

	async function fetchClientBookings() {
		if (!$clientUser) return;
		loadingBookings = true;
		try {
			const res = await fetch('/api/client/bookings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					clientFirebaseUid: $clientUser.uid,
					email: $clientUser.email
				})
			});

			if (res.ok) {
				const data = (await res.json()) as { bookings: any[] };
				bookings = data.bookings || [];
			}
		} catch (e) {
			console.error('Failed to load client bookings:', e);
		} finally {
			loadingBookings = false;
		}
	}

	async function handleGoogleLogin() {
		authError = '';
		authSubmitting = true;
		try {
			await signInWithGoogle();
		} catch (err: any) {
			authError = err.message || 'Google sign-in was canceled or failed.';
		} finally {
			authSubmitting = false;
		}
	}

	async function handleEmailAuth(e: SubmitEvent) {
		e.preventDefault();
		authError = '';
		if (!emailInput || !passwordInput) {
			authError = 'Please provide both email and password.';
			return;
		}

		authSubmitting = true;
		try {
			if (authMode === 'login') {
				await signInWithEmail(emailInput.trim(), passwordInput);
			} else {
				if (!nameInput.trim()) {
					authError = 'Please provide your full name.';
					authSubmitting = false;
					return;
				}
				await signUpWithEmail(emailInput.trim(), passwordInput, nameInput.trim());
			}
		} catch (err: any) {
			authError = err.message || 'Authentication failed. Please check your credentials.';
		} finally {
			authSubmitting = false;
		}
	}

	const upcomingSessions = $derived(
		bookings.filter(
			(b) => b.status !== 'canceled' && new Date(b.endTime).getTime() >= Date.now()
		)
	);

	const pastSessions = $derived(
		bookings.filter(
			(b) => b.status === 'canceled' || new Date(b.endTime).getTime() < Date.now()
		)
	);

	function formatDateTime(dateStr: string): string {
		try {
			const d = new Date(dateStr);
			return d.toLocaleString('en-US', {
				weekday: 'short',
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
	<title>Client Portal | Neubofy™ Strategic Consultations</title>
	<meta name="description" content="Secure client portal to view upcoming technology consultations, join Google Meet / Teams calls, and review session notes." />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col selection:bg-blue-500/30 selection:text-blue-200">
	<!-- Navbar -->
	<header class="border-b border-white/10 bg-[#0d0d12]/80 backdrop-blur-md sticky top-0 z-30">
		<div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
			<a href="/" class="flex items-center gap-2.5 group">
				<img
					src="https://neubofy.in/neubofylogo.png"
					alt="Neubofy"
					class="w-7 h-7 rounded-full object-cover border border-white/20 group-hover:scale-105 transition-transform"
				/>
				<span class="font-bold text-white text-base tracking-tight">Neubofy™</span>
				<span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
					Client Portal
				</span>
			</a>

			<div class="flex items-center gap-3">
				{#if $clientUser}
					<div class="hidden sm:flex items-center gap-2 text-xs">
						{#if $clientUser.photoURL}
							<img src={$clientUser.photoURL} alt="Profile" class="w-6 h-6 rounded-full border border-white/20" />
						{/if}
						<span class="text-zinc-300 font-medium">{$clientUser.displayName || $clientUser.email}</span>
					</div>
					<button
						type="button"
						onclick={signOutClient}
						class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10 transition-colors"
					>
						Sign Out
					</button>
				{:else}
					<a
						href="/"
						class="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm"
					>
						Book Consultation
					</a>
				{/if}
			</div>
		</div>
	</header>

	<main class="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
		{#if $clientAuthLoading}
			<div class="py-20 text-center">
				<div class="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
				<p class="text-xs text-zinc-400 mt-3 font-mono">Verifying authentication session...</p>
			</div>
		{:else if !$clientUser}
			<!-- Auth Required Card -->
			<div class="max-w-md mx-auto">
				<div class="p-6 sm:p-8 rounded-3xl bg-[#121216] border border-white/10 shadow-2xl space-y-6">
					<div class="text-center space-y-2">
						<div class="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center text-2xl mx-auto shadow-inner">
							🔐
						</div>
						<h1 class="text-xl sm:text-2xl font-black text-white tracking-tight">Client Portal</h1>
						<p class="text-xs text-zinc-400">
							Sign in with your verified account to view your scheduled sessions, video meeting links, and consultation history.
						</p>
					</div>

					<!-- Google Quick Login -->
					<button
						type="button"
						onclick={handleGoogleLogin}
						disabled={authSubmitting}
						class="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white text-zinc-900 font-bold text-xs hover:bg-zinc-100 transition-all shadow-md disabled:opacity-50"
					>
						<svg class="w-4 h-4" viewBox="0 0 24 24">
							<path
								fill="#4285F4"
								d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
							/>
							<path
								fill="#34A853"
								d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
							/>
							<path
								fill="#FBBC05"
								d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
							/>
							<path
								fill="#EA4335"
								d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
							/>
						</svg>
						<span>Continue with Google</span>
					</button>

					<div class="flex items-center gap-3">
						<div class="flex-1 h-px bg-white/10"></div>
						<span class="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">or with email</span>
						<div class="flex-1 h-px bg-white/10"></div>
					</div>

					<!-- Auth Mode Toggle -->
					<div class="grid grid-cols-2 p-1 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold">
						<button
							type="button"
							onclick={() => { authMode = 'login'; authError = ''; }}
							class="py-1.5 rounded-lg transition-all {authMode === 'login' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}"
						>
							Sign In
						</button>
						<button
							type="button"
							onclick={() => { authMode = 'signup'; authError = ''; }}
							class="py-1.5 rounded-lg transition-all {authMode === 'signup' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}"
						>
							Create Account
						</button>
					</div>

					<!-- Email/Pass Form -->
					<form onsubmit={handleEmailAuth} class="space-y-3.5">
						{#if authMode === 'signup'}
							<div>
								<label for="client_name" class="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
									Full Name
								</label>
								<input
									type="text"
									id="client_name"
									bind:value={nameInput}
									placeholder="e.g. John Doe"
									class="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
								/>
							</div>
						{/if}

						<div>
							<label for="client_email" class="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
								Email Address
							</label>
							<input
								type="email"
								id="client_email"
								bind:value={emailInput}
								placeholder="you@company.com"
								required
								class="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
							/>
						</div>

						<div>
							<label for="client_password" class="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
								Password
							</label>
							<input
								type="password"
								id="client_password"
								bind:value={passwordInput}
								placeholder="••••••••"
								required
								minlength="6"
								class="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
							/>
						</div>

						{#if authError}
							<div class="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
								{authError}
							</div>
						{/if}

						<button
							type="submit"
							disabled={authSubmitting}
							class="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors shadow-lg shadow-blue-500/25 disabled:opacity-50"
						>
							{authSubmitting ? 'Verifying...' : authMode === 'login' ? 'Sign In to Portal' : 'Create Client Account'}
						</button>
					</form>
				</div>
			</div>
		{:else}
			<!-- Authenticated Client Dashboard -->
			<div class="space-y-8">
				<!-- Welcome Card -->
				<div class="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-900/30 via-[#121216] to-[#121216] border border-white/10 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
					<div class="flex items-center gap-4">
						<div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-lg shrink-0">
							{($clientUser.displayName || $clientUser.email || 'U').charAt(0).toUpperCase()}
						</div>
						<div>
							<div class="text-xs text-blue-400 font-bold uppercase tracking-wider">Welcome back</div>
							<h1 class="text-xl sm:text-2xl font-black text-white tracking-tight">
								{$clientUser.displayName || 'Client'}
							</h1>
							<p class="text-xs text-zinc-400 font-mono mt-0.5">{$clientUser.email}</p>
						</div>
					</div>

					<div class="flex items-center gap-3">
						<a
							href="/"
							class="px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-500/20 flex items-center gap-2"
						>
							<span>➕</span>
							<span>Book New Session</span>
						</a>
					</div>
				</div>

				<!-- Tabs & Bookings List -->
				<div class="space-y-4">
					<div class="flex items-center gap-2 border-b border-white/10 pb-3">
						<button
							type="button"
							onclick={() => (activeTab = 'upcoming')}
							class="px-4 py-2 rounded-xl text-xs font-bold transition-all {activeTab === 'upcoming'
								? 'bg-blue-600 text-white shadow-md'
								: 'text-zinc-400 hover:text-white hover:bg-white/5'}"
						>
							Upcoming Consultations ({upcomingSessions.length})
						</button>
						<button
							type="button"
							onclick={() => (activeTab = 'past')}
							class="px-4 py-2 rounded-xl text-xs font-bold transition-all {activeTab === 'past'
								? 'bg-blue-600 text-white shadow-md'
								: 'text-zinc-400 hover:text-white hover:bg-white/5'}"
						>
							Past History ({pastSessions.length})
						</button>
					</div>

					{#if loadingBookings}
						<div class="py-12 text-center text-zinc-400 text-xs font-mono">
							Loading consultation schedule...
						</div>
					{:else}
						{@const displayList = activeTab === 'upcoming' ? upcomingSessions : pastSessions}

						{#if displayList.length === 0}
							<div class="p-12 text-center rounded-3xl bg-[#121216] border border-white/10 space-y-3">
								<div class="text-4xl">📅</div>
								<h3 class="text-base font-bold text-white">
									{activeTab === 'upcoming' ? 'No upcoming consultations' : 'No past consultations recorded'}
								</h3>
								<p class="text-xs text-zinc-400 max-w-sm mx-auto">
									{activeTab === 'upcoming'
										? 'You do not have any scheduled consultations at the moment. Need technical strategy or architecture advice?'
										: 'Your completed or previous consultations will be securely archived here.'}
								</p>
								{#if activeTab === 'upcoming'}
									<div class="pt-2">
										<a
											href="/"
											class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
										>
											Schedule Consultation
										</a>
									</div>
								{/if}
							</div>
						{:else}
							<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
								{#each displayList as session}
									<div class="p-5 rounded-2xl bg-[#121216] border border-white/10 hover:border-white/20 transition-all space-y-4 shadow-sm flex flex-col justify-between">
										<div class="space-y-3">
											<!-- Header -->
											<div class="flex items-start justify-between gap-3">
												<div>
													<span class="text-[10px] font-bold uppercase tracking-wider text-blue-400">
														Consultation
													</span>
													<h3 class="text-base font-bold text-white leading-snug">
														{session.eventName}
													</h3>
												</div>
												<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase {session.status === 'confirmed' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}">
													{session.status}
												</span>
											</div>

											<!-- Expert Profile -->
											<div class="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
												<div class="w-9 h-9 rounded-full bg-blue-600/30 border border-blue-500/40 text-blue-300 flex items-center justify-center font-bold text-xs shrink-0">
													{(session.expertName || 'E').charAt(0).toUpperCase()}
												</div>
												<div>
													<div class="text-xs font-bold text-white">{session.expertName}</div>
													<div class="text-[11px] text-zinc-400">{session.expertRole || 'Lead Specialist'}</div>
												</div>
											</div>

											<!-- Time & Date -->
											<div class="text-xs space-y-1 font-mono text-zinc-300 bg-white/5 p-3 rounded-xl">
												<div>📅 {formatDateTime(session.startTime)}</div>
												<div class="text-zinc-400 text-[11px]">⏱️ {session.durationMinutes} Minutes Session</div>
												{#if session.couponCode}
													<div class="text-emerald-400 text-[11px]">🎟️ Waiver Applied: {session.couponCode}</div>
												{/if}
											</div>
										</div>

										<!-- Actions -->
										<div class="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
											{#if session.meetingUrl && session.status === 'confirmed'}
												<a
													href={session.meetingUrl}
													target="_blank"
													class="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-md shadow-blue-500/20 flex items-center gap-1.5"
												>
													<span>🎥</span>
													<span>Join Google Meet</span>
												</a>
											{/if}

											{#if session.status === 'confirmed'}
												<div class="flex items-center gap-2">
													<a
														href="/reschedule/{session.id}"
														class="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
													>
														Reschedule
													</a>
													<a
														href="/cancel/{session.id}"
														class="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-colors"
													>
														Cancel
													</a>
												</div>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{/if}
					{/if}
				</div>
			</div>
		{/if}
	</main>
</div>
