<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let isSubmitting = $state(false);
</script>

<svelte:head>
	<title>Expert & Team Member Login | Neubofy™</title>
	<meta name="description" content="Sign in to Neubofy Expert Portal to manage consultation schedules, working hours, and client appointments." />
</svelte:head>

<div class="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white relative overflow-hidden">
	<!-- Ambient Background Glows -->
	<div class="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none"></div>
	<div class="absolute bottom-10 right-10 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none"></div>

	<!-- Top Header -->
	<header class="border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-50">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
			<a href="/" class="flex items-center space-x-3 group">
				<img
					src="https://neubofy.in/neubofylogo.png"
					alt="Neubofy"
					class="w-9 h-9 rounded-full object-cover border border-white/20 group-hover:scale-105 transition-transform"
				/>
				<div>
					<span class="text-xl font-bold text-white tracking-tight">Neubofy™</span>
					<span class="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
						Expert Portal
					</span>
				</div>
			</a>

			<a
				href="/"
				class="text-xs sm:text-sm font-medium text-zinc-400 hover:text-white transition-colors"
			>
				← Client Booking Portal
			</a>
		</div>
	</header>

	<!-- Main Login Card -->
	<main class="flex-1 flex items-center justify-center px-4 py-12 sm:py-16 relative z-10">
		<div class="max-w-md w-full">
			<div class="glass-card rounded-3xl p-8 sm:p-10 border border-white/10 shadow-2xl backdrop-blur-xl relative">
				<div class="text-center mb-8">
					<div class="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-2xl mx-auto mb-4">
						🛡️
					</div>
					<h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">
						Expert Portal Sign In
					</h1>
					<p class="text-xs sm:text-sm text-zinc-400 mt-2">
						Access your personal consultant workspace, manage schedules, and conduct client sessions.
					</p>
				</div>

				<!-- Role & Permission Notice -->
				<div class="p-4 rounded-2xl bg-white/[0.02] border border-white/10 mb-6 space-y-2">
					<div class="flex items-center justify-between text-xs">
						<span class="text-zinc-400 font-semibold uppercase tracking-wider">Authorized Roles:</span>
						<span class="text-blue-400 font-bold">Owner &bull; Admin &bull; Expert</span>
					</div>
					<p class="text-[11px] text-zinc-500 leading-relaxed">
						Access is restricted to authorized Neubofy specialists. Unauthorized sign-in attempts without active organization invitations will be rejected.
					</p>
				</div>

				<!-- Form Error Display -->
				{#if form?.error}
					<div class="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold mb-6 flex items-start gap-2">
						<span class="text-base shrink-0">⚠️</span>
						<div class="space-y-1">
							<p>{form.error}</p>
							{#if (form as any)?.missingOAuth}
								<p class="text-[11px] text-red-300/80">
									Set <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>, and <code>APP_URL</code> in environment variables.
								</p>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Sign In Actions -->
				<div class="space-y-4">
					{#if data.hasGoogleOAuth}
						<!-- Official Google OAuth Button -->
						<form
							method="POST"
							action="?/google"
							use:enhance={() => {
								isSubmitting = true;
								return async ({ update }) => {
									isSubmitting = false;
									await update();
								};
							}}
						>
							<button
								type="submit"
								disabled={isSubmitting}
								class="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-white hover:bg-zinc-100 text-zinc-950 transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-white/20 disabled:opacity-50"
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
								<span>{isSubmitting ? 'Connecting to Google...' : 'Sign in with Google Workspace'}</span>
							</button>
						</form>
					{:else}
						<!-- OAuth Notice -->
						<div class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs leading-relaxed space-y-1.5">
							<div class="font-bold flex items-center gap-1.5">
								<span>⚙️</span>
								<span>Google OAuth Unconfigured</span>
							</div>
							<p class="text-[11px] text-amber-200/80">
								Google OAuth keys are not detected in your local environment. To test the Expert Portal without Google Cloud setup, click Super Admin Access below.
							</p>
						</div>
					{/if}
				</div>

				<!-- Footer Links -->
				<div class="mt-8 pt-6 border-t border-white/10 text-center">
					<a
						href="https://neubofy.zohodesk.in/portal"
						target="_blank"
						rel="noreferrer"
						class="text-xs text-zinc-400 hover:text-zinc-200 transition-colors inline-flex items-center gap-1"
					>
						<span>Need an expert invitation? Contact Support</span>
						<span>↗</span>
					</a>
				</div>
			</div>
		</div>
	</main>

	<!-- Footer -->
	<footer class="border-t border-white/10 py-6 text-center text-xs text-zinc-500">
		<p>© {new Date().getFullYear()} Neubofy™. Technology, Without the Guesswork.</p>
	</footer>
</div>
