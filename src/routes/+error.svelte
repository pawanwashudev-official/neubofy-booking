<script lang="ts">
	import { page } from '$app/stores';

	// Extract status and error details safely
	const status = $derived($page.status || 500);
	const err = $derived(($page.error as any) || {});

	// Compute user-friendly titles and reasons based on status code
	const is401 = $derived(status === 401);
	const is403 = $derived(status === 403);
	const is404 = $derived(status === 404);
	const is500 = $derived(status >= 500);

	const title = $derived(
		err.message ||
			(is401
				? 'Authentication Required'
				: is403
					? 'Access Denied — Permission Required'
					: is404
						? 'Page Not Found'
						: 'System Notice — Configuration Required')
	);

	const errorReason = $derived(
		err.reason ||
			(is401
				? 'You must be signed in with an authorized organization account to access the Neubofy Expert Portal.'
				: is403
					? 'Your account does not possess the required role or authorization level to access this section.'
					: is404
						? 'The requested page, consultation service, or dashboard section could not be located.'
						: 'An unhandled server exception or missing configuration was encountered.')
	);

	const permissionNeeded = $derived(
		err.permissionNeeded ||
			(is401
				? 'Authorized Expert or Member Account'
				: is403
					? 'Super Admin or Administrator Privileges'
					: null)
	);

	const currentRole = $derived(err.currentRole || (is401 ? 'Guest (Not Signed In)' : 'Unassigned / Restricted'));
</script>

<svelte:head>
	<title>{status}: {title} | Neubofy™</title>
</svelte:head>

<div class="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white relative overflow-hidden">
	<!-- Ambient Background Glows -->
	<div
		class="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-[140px] pointer-events-none {is403
			? 'bg-rose-600/15'
			: is401
				? 'bg-amber-600/15'
				: is404
					? 'bg-blue-600/15'
					: 'bg-purple-600/15'}"
	></div>

	<!-- Top Header -->
	<header class="border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-50">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
			<a href="/" class="flex items-center space-x-3 group">
				<img
					src="https://neubofy.in/neubofylogo.png"
					alt="Neubofy"
					class="w-9 h-9 rounded-full object-cover border border-white/20 group-hover:scale-105 transition-transform"
				/>
				<div class="flex items-center gap-2">
					<span class="text-xl font-bold text-white tracking-tight">Neubofy™</span>
					<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400">
						Consultation Portal
					</span>
				</div>
			</a>

			<div class="flex items-center space-x-4">
				<a
					href="/"
					class="text-xs sm:text-sm font-medium text-zinc-400 hover:text-white transition-colors"
				>
					Booking Home
				</a>
				<a
					href="/auth/login"
					class="inline-flex items-center justify-center px-4 py-2 text-xs sm:text-sm font-medium rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all"
				>
					Expert Portal →
				</a>
			</div>
		</div>
	</header>

	<!-- Main Error Card Area -->
	<main class="flex-1 flex items-center justify-center px-4 py-12 sm:py-16 relative z-10">
		<div class="max-w-xl w-full">
			<div
				class="glass-card rounded-3xl p-8 sm:p-10 border shadow-2xl relative overflow-hidden backdrop-blur-xl {is403
					? 'border-rose-500/30 shadow-rose-950/20'
					: is401
						? 'border-amber-500/30 shadow-amber-950/20'
						: is404
							? 'border-blue-500/30 shadow-blue-950/20'
							: 'border-purple-500/30 shadow-purple-950/20'}"
			>
				<!-- Badge & Status Code -->
				<div class="flex items-center justify-between gap-4 mb-6">
					<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider {is403
						? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
						: is401
							? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
							: is404
								? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
								: 'bg-purple-500/15 text-purple-400 border border-purple-500/30'}">
						<span class="w-2 h-2 rounded-full {is403
							? 'bg-rose-400 animate-ping'
							: is401
								? 'bg-amber-400'
								: is404
									? 'bg-blue-400'
									: 'bg-purple-400'}"></span>
						{#if is403}
							Access Denied &bull; 403
						{:else if is401}
							Unauthorized &bull; 401
						{:else if is404}
							Not Found &bull; 404
						{:else}
							Server Notice &bull; {status}
						{/if}
					</div>

					<span class="text-3xl font-black text-white/20 tracking-tighter">
						#{status}
					</span>
				</div>

				<!-- Heading -->
				<h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3">
					{title}
				</h1>

				<!-- Primary Description -->
				<p class="text-sm text-zinc-400 leading-relaxed mb-6">
					{errorReason}
				</p>

				<!-- Permission & Diagnostics Box -->
				{#if permissionNeeded || is403 || is401}
					<div class="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3 mb-8">
						<div class="flex items-start justify-between gap-3 text-xs">
							<span class="text-zinc-500 font-semibold uppercase tracking-wider">Required Permission:</span>
							<span class="font-bold text-rose-300 text-right">
								{permissionNeeded || 'Super Admin or Organization Member'}
							</span>
						</div>

						<div class="flex items-start justify-between gap-3 text-xs pt-2 border-t border-white/5">
							<span class="text-zinc-500 font-semibold uppercase tracking-wider">Current Account Level:</span>
							<span class="font-medium text-zinc-300 text-right">
								{currentRole}
							</span>
						</div>

						{#if is403}
							<div class="pt-2 border-t border-white/5 text-[11px] text-zinc-400 leading-relaxed">
								💡 <strong>Resolution:</strong> If you are a team member or consultant at Neubofy, ask the Super Admin or Owner to grant you the required role in the <span class="text-zinc-200">Team & Experts Directory</span> or accept your invitation.
							</div>
						{/if}
					</div>
				{:else if is500}
					<div class="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2 mb-8">
						<div class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Diagnostic Details</div>
						<pre class="text-xs text-rose-300 font-mono bg-black/60 p-3 rounded-xl overflow-x-auto whitespace-pre-wrap">{err.message || 'Server error occurred'}</pre>
						<p class="text-[11px] text-zinc-400 pt-1">
							💡 Check your environment configuration (Google OAuth credentials or database connection) or retry.
						</p>
					</div>
				{/if}

				<!-- Action Buttons -->
				<div class="flex flex-col sm:flex-row items-center gap-3">
					{#if is401 || is403}
						<a
							href="/auth/login"
							class="w-full sm:flex-1 btn-electric py-3 px-5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(59,130,246,0.5)]"
						>
							<span>🔑 Sign In / Switch Account</span>
							<span>→</span>
						</a>
					{:else if is500}
						<button
							type="button"
							onclick={() => window.location.reload()}
							class="w-full sm:flex-1 btn-electric py-3 px-5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2"
						>
							<span>🔄 Retry Action</span>
						</button>
					{/if}

					<a
						href="/"
						class="w-full sm:w-auto px-5 py-3 rounded-xl text-xs sm:text-sm font-semibold bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition-all text-center"
					>
						← Back to Home
					</a>
				</div>
			</div>

			<!-- Secondary Footer Support Link -->
			<div class="mt-6 text-center">
				<a
					href="https://neubofy.zohodesk.in/portal"
					target="_blank"
					rel="noreferrer"
					class="text-xs text-zinc-500 hover:text-zinc-300 transition-colors inline-flex items-center gap-1.5"
				>
					<span>Need assistance? Contact Neubofy Help Centre</span>
					<span>↗</span>
				</a>
			</div>
		</div>
	</main>

	<!-- Bottom Brand Footer -->
	<footer class="border-t border-white/10 py-6 text-center text-xs text-zinc-500">
		<p>© {new Date().getFullYear()} Neubofy™. Technology, Without the Guesswork.</p>
	</footer>
</div>
