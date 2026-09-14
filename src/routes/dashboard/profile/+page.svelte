<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let name = $state<string>(data.profile?.name || '');
	let roleTitle = $state<string>(data.profile?.role_title || 'Technology Consultant');
	let bio = $state<string>(data.profile?.bio || '');
	let phone = $state<string>(data.profile?.phone || '');
	let profileImageUrl = $state<string>(data.profile?.profile_image || '');
	let brandColor = $state<string>(data.profile?.brand_color || '#3b82f6');
	let contactEmail = $state<string>(data.profile?.contact_email || data.profile?.email || '');
	let isFreeConsultation = $state<boolean>(true);

	// Variable session pricing tiers
	let sessionTiers = $state<Array<{ duration: number; price: number; label: string }>>(
		data.profile?.session_pricing && data.profile.session_pricing.length > 0
			? JSON.parse(JSON.stringify(data.profile.session_pricing))
			: []
	);

	let saving = $state<boolean>(false);
	let saveMessage = $state<string>('');
	let saveError = $state<string>('');

	function addTier() {
		sessionTiers.push({
			duration: 30,
			price: 0,
			label: '30 Min Consultation'
		});
	}

	function removeTier(index: number) {
		sessionTiers.splice(index, 1);
	}

	async function handleSaveProfile() {
		saving = true;
		saveMessage = '';
		saveError = '';

		try {
			const res = await fetch('/api/profile', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					roleTitle: roleTitle.trim(),
					bio: bio.trim(),
					phone: phone.trim(),
					profileImage: profileImageUrl.trim() || null,
					brandColor,
					contactEmail: contactEmail.trim(),
					sessionPricing: sessionTiers,
					isFreeConsultation: true
				})
			});

			const json = (await res.json()) as any;
			if (!res.ok) {
				throw new Error(json.message || 'Failed to save profile');
			}

			saveMessage = 'Profile and variable session tiers updated successfully!';
			setTimeout(() => {
				saveMessage = '';
			}, 4000);
		} catch (err: any) {
			saveError = err.message || 'An error occurred while saving profile.';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Expert Profile & Session Rates | Neubofy™</title>
</svelte:head>

<div class="p-6 sm:p-10 max-w-4xl mx-auto space-y-8 animate-fade-in">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">Expert Profile & Session Rates</h1>
			<p class="text-sm text-zinc-400 mt-1">
				Configure your public expert bio, role, contact phone, and customizable session pricing tiers.
			</p>
		</div>

		<button
			type="button"
			disabled={saving}
			onclick={handleSaveProfile}
			class="btn-electric px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-[0_0_20px_rgba(59,130,246,0.4)] disabled:opacity-50"
		>
			{saving ? 'Saving...' : 'Save Changes'}
		</button>
	</div>

	{#if saveMessage}
		<div class="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
			✓ {saveMessage}
		</div>
	{/if}
	{#if saveError}
		<div class="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold">
			✕ {saveError}
		</div>
	{/if}

	<!-- Profile Details Form -->
	<div class="glass-card rounded-2xl p-6 sm:p-8 border border-white/10 space-y-6">
		<h2 class="text-base font-bold text-white">Consultant Details</h2>

		<!-- Public Avatar Preview & URL -->
		<div class="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-4 rounded-xl bg-white/[0.02] border border-white/5">
			<div class="shrink-0">
				{#if profileImageUrl}
					<img
						src={profileImageUrl}
						alt="Avatar Preview"
						class="w-20 h-20 rounded-2xl object-cover border border-white/20 shadow-md"
						onerror={() => (saveError = 'Failed to load avatar from URL. Please ensure it is a valid public image.')}
					/>
				{:else}
					<div
						class="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold text-2xl border border-white/20"
						style="background: {brandColor}"
					>
						{name.charAt(0) || 'E'}
					</div>
				{/if}
			</div>

			<div class="flex-1 w-full space-y-2">
				<label for="profile-avatar-url" class="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
					Public Avatar Image URL
				</label>
				<input
					id="profile-avatar-url"
					type="url"
					bind:value={profileImageUrl}
					placeholder="https://images.unsplash.com/... or https://neubofy.in/..."
					class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs outline-none focus:border-blue-500"
				/>
				<p class="text-[11px] text-zinc-500">
					* We do not store image files in the database; paste any public HTTPS link (e.g. LinkedIn, Unsplash, Imgur, Cloudinary).
				</p>
			</div>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<div>
				<label for="profile-name" class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
					Full Name
				</label>
				<input
					id="profile-name"
					type="text"
					bind:value={name}
					class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-blue-500"
				/>
			</div>

			<div>
				<label for="profile-role" class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
					Professional Title / Role
				</label>
				<input
					id="profile-role"
					type="text"
					bind:value={roleTitle}
					placeholder="e.g. Lead AI & Systems Architect"
					class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-blue-500"
				/>
			</div>

			<div>
				<label for="profile-phone" class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
					Contact / WhatsApp Number
				</label>
				<input
					id="profile-phone"
					type="text"
					bind:value={phone}
					placeholder="+91 98765 43210"
					class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-blue-500"
				/>
			</div>

			<div>
				<label for="profile-email" class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
					Contact Email for Booking Notifications
				</label>
				<input
					id="profile-email"
					type="email"
					bind:value={contactEmail}
					class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-blue-500"
				/>
			</div>
		</div>

		<div>
			<label for="profile-bio" class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
				Expert Bio
			</label>
			<textarea
				id="profile-bio"
				bind:value={bio}
				rows={3}
				placeholder="Briefly describe your areas of expertise, technologies, and advisory background..."
				class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs outline-none focus:border-blue-500"
			></textarea>
		</div>
	</div>

	<!-- Variable Session Durations & Pricing Packages -->
	<div class="glass-card rounded-2xl p-6 sm:p-8 border border-white/10 space-y-6">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<div>
				<h2 class="text-base font-bold text-white">Customizable Session Pricing Packages</h2>
				<p class="text-xs text-zinc-400 mt-0.5">
					Set your desired consultation duration (in minutes) and your desired per-session price.
				</p>
			</div>

			<button
				type="button"
				onclick={addTier}
				class="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/15 transition-all"
			>
				+ Add Duration Tier
			</button>
		</div>

		<!-- Complimentary Banner -->
		<div class="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-3">
			<span class="text-base">ℹ️</span>
			<div>
				<strong class="font-bold">Current Release Policy: Complimentary Strategy Sessions</strong>
				<p class="text-zinc-400 mt-0.5 leading-relaxed">
					All consultations are currently complimentary for clients (paid checkout disabled). Your desired prices will appear crossed-out on the public portal so clients see your real value, and will automatically take effect once paid booking is activated.
				</p>
			</div>
		</div>

		<!-- Tiers List -->
		<div class="space-y-3">
			{#each sessionTiers as tier, index}
				<div class="p-4 rounded-xl bg-white/[0.02] border border-white/10 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
					<!-- Duration -->
					<div class="sm:col-span-3">
						<label class="block text-[10px] font-bold uppercase text-zinc-500 mb-1">
							Duration (Mins)
						</label>
						<div class="flex items-center gap-1">
							<input
								type="number"
								min={15}
								max={240}
								step={5}
								bind:value={tier.duration}
								class="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs outline-none focus:border-blue-500 font-mono"
							/>
							<span class="text-xs text-zinc-500">m</span>
						</div>
					</div>

					<!-- Desired Price -->
					<div class="sm:col-span-3">
						<label class="block text-[10px] font-bold uppercase text-zinc-500 mb-1">
							Desired Price (₹)
						</label>
						<div class="flex items-center gap-1">
							<span class="text-xs text-zinc-500">₹</span>
							<input
								type="number"
								min={0}
								step={100}
								bind:value={tier.price}
								class="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs outline-none focus:border-blue-500 font-mono"
							/>
						</div>
					</div>

					<!-- Label -->
					<div class="sm:col-span-5">
						<label class="block text-[10px] font-bold uppercase text-zinc-500 mb-1">
							Tier Package Label
						</label>
						<input
							type="text"
							bind:value={tier.label}
							placeholder="e.g. 30 Min Strategy Call"
							class="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs outline-none focus:border-blue-500"
						/>
					</div>

					<!-- Delete -->
					<div class="sm:col-span-1 text-right sm:pt-4">
						<button
							type="button"
							onclick={() => removeTier(index)}
							title="Delete Tier"
							class="p-2 text-zinc-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors text-xs"
						>
							🗑
						</button>
					</div>
				</div>
			{/each}
		</div>

		<div class="flex justify-end pt-4 border-t border-white/10">
			<button
				type="button"
				disabled={saving}
				onclick={handleSaveProfile}
				class="btn-electric px-8 py-3 rounded-xl text-xs sm:text-sm font-bold shadow-[0_0_20px_rgba(59,130,246,0.4)] disabled:opacity-50"
			>
				{saving ? 'Saving...' : 'Save All Settings'}
			</button>
		</div>
	</div>

	<!-- Session Security & Sign Out Section -->
	<div class="glass-card rounded-2xl p-6 sm:p-8 border border-white/10 space-y-4">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<div>
				<h2 class="text-base sm:text-lg font-bold text-white flex items-center gap-2">
					<span>🔒</span>
					<span>Active Session & Security</span>
				</h2>
				<p class="text-xs text-zinc-400 mt-1">
					Signed in as <strong class="text-zinc-200">{data.profile?.email || 'authenticated user'}</strong>. Sign out if using a shared workstation.
				</p>
			</div>

			<a
				href="/auth/logout"
				class="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 transition-all flex items-center justify-center gap-2 shadow-sm shrink-0"
			>
				<span>🚪</span>
				<span>Sign Out of Portal</span>
			</a>
		</div>
	</div>
</div>
