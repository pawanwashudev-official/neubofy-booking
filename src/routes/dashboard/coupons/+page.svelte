<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showCreateModal = $state(false);
	let newCode = $state('');
	let newDiscountType = $state<'percentage' | 'fixed'>('percentage');
	let newDiscountValue = $state<number>(100);
	let newMaxUses = $state<string>('');
	let newEventTypeId = $state<string>('');
	let newExpiresAt = $state<string>('');
	let isSubmitting = $state(false);
	let copiedCode = $state<string | null>(null);

	function copyToClipboard(code: string) {
		navigator.clipboard.writeText(code);
		copiedCode = code;
		setTimeout(() => {
			copiedCode = null;
		}, 2000);
	}
</script>

<svelte:head>
	<title>Coupons & Discounts | Neubofy™ Dashboard</title>
</svelte:head>

<div class="p-6 sm:p-10 max-w-7xl mx-auto space-y-8 animate-fade-in">
	<!-- Top Bar -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<div class="flex items-center gap-2 mb-1">
				<span class="text-xs font-bold uppercase tracking-wider text-blue-400">Organization Controls</span>
				<span class="text-zinc-600">•</span>
				<span class="text-xs text-zinc-400">Pricing & Promotions</span>
			</div>
			<h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">Coupons & Discounts</h1>
			<p class="text-xs sm:text-sm text-zinc-400 mt-1">
				Generate promotional discount codes and 100% complimentary VIP waivers for client consultations.
			</p>
		</div>

		<button
			type="button"
			onclick={() => (showCreateModal = true)}
			class="btn-electric py-2.5 px-5 rounded-xl font-bold text-xs sm:text-sm shadow-[0_0_20px_rgba(59,130,246,0.35)] flex items-center justify-center gap-2 self-start sm:self-auto"
		>
			<span>+</span>
			<span>Create New Coupon</span>
		</button>
	</div>

	{#if form?.error}
		<div class="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold">
			✕ {form.error}
		</div>
	{/if}

	<!-- Coupons Grid -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
		{#each data.coupons as coupon}
			{@const isComplimentary = coupon.discount_type === 'percentage' && coupon.discount_value === 100}
			{@const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date()}
			<div class="glass-card rounded-2xl p-5 border border-white/10 shadow-xl flex flex-col justify-between space-y-4 hover:border-white/20 transition-all {coupon.is_active === 1 && !isExpired ? '' : 'opacity-60'}">
				<div>
					<div class="flex items-center justify-between gap-2 mb-3">
						<div class="flex items-center gap-2">
							<span class="font-mono text-base font-bold text-white tracking-wider px-2.5 py-1 rounded-lg bg-white/10 border border-white/15">
								{coupon.code}
							</span>
							<button
								type="button"
								onclick={() => copyToClipboard(coupon.code)}
								class="p-1 rounded text-zinc-400 hover:text-white transition-colors text-xs"
								title="Copy code"
							>
								{#if copiedCode === coupon.code}
									<span class="text-emerald-400 font-bold text-[10px]">Copied!</span>
								{:else}
									<span>📋</span>
								{/if}
							</button>
						</div>

						{#if isComplimentary}
							<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
								100% Free VIP
							</span>
						{:else if coupon.discount_type === 'percentage'}
							<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
								{coupon.discount_value}% OFF
							</span>
						{:else}
							<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
								₹{coupon.discount_value} OFF
							</span>
						{/if}
					</div>

					<div class="space-y-1.5 text-xs text-zinc-400">
						<div class="flex items-center justify-between">
							<span>Scope:</span>
							<span class="text-zinc-200 font-medium">{coupon.event_type_name || 'All Consultations'}</span>
						</div>
						<div class="flex items-center justify-between">
							<span>Redemptions:</span>
							<span class="text-zinc-200 font-mono">
								{coupon.used_count} {coupon.max_uses !== null ? `/ ${coupon.max_uses}` : 'used'}
							</span>
						</div>
						{#if coupon.expires_at}
							<div class="flex items-center justify-between">
								<span>Expires:</span>
								<span class="{isExpired ? 'text-red-400 font-bold' : 'text-zinc-300'}">
									{new Date(coupon.expires_at).toLocaleDateString()} {isExpired ? '(Expired)' : ''}
								</span>
							</div>
						{/if}
					</div>
				</div>

				<!-- Actions Bar -->
				<div class="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
					<form method="POST" action="?/toggle" use:enhance>
						<input type="hidden" name="id" value={coupon.id} />
						<input type="hidden" name="is_active" value={coupon.is_active} />
						<button
							type="submit"
							class="font-semibold flex items-center gap-1.5 transition-colors {coupon.is_active === 1
								? 'text-emerald-400 hover:text-emerald-300'
								: 'text-zinc-500 hover:text-zinc-400'}"
						>
							<span class="w-2 h-2 rounded-full {coupon.is_active === 1 ? 'bg-emerald-400' : 'bg-zinc-600'}"></span>
							<span>{coupon.is_active === 1 ? 'Active' : 'Disabled'}</span>
						</button>
					</form>

					<form method="POST" action="?/delete" use:enhance>
						<input type="hidden" name="id" value={coupon.id} />
						<button
							type="submit"
							class="text-zinc-500 hover:text-red-400 transition-colors p-1"
							title="Delete coupon"
						>
							🗑
						</button>
					</form>
				</div>
			</div>
		{/each}

		{#if data.coupons.length === 0}
			<div class="col-span-full p-12 text-center glass-card rounded-2xl border border-white/10 space-y-3">
				<span class="text-4xl">🏷️</span>
				<h3 class="text-base font-bold text-white">No Coupons Created Yet</h3>
				<p class="text-xs text-zinc-400 max-w-sm mx-auto">
					Create coupon codes to offer 100% complimentary waivers or percentage discounts to select clients.
				</p>
				<button
					type="button"
					onclick={() => (showCreateModal = true)}
					class="mt-2 btn-electric py-2 px-4 rounded-xl text-xs font-bold"
				>
					+ Create First Coupon
				</button>
			</div>
		{/if}
	</div>
</div>

<!-- Create Coupon Modal -->
{#if showCreateModal}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
		<div
			class="w-full max-w-md bg-[#121216] border border-white/15 rounded-2xl shadow-2xl p-6 text-white space-y-6 animate-fade-in"
			role="dialog"
			aria-modal="true"
		>
			<div class="flex items-center justify-between border-b border-white/10 pb-4">
				<div>
					<h2 class="text-lg font-bold">Create New Coupon</h2>
					<p class="text-xs text-zinc-400 mt-0.5">Define promo code & discount value</p>
				</div>
				<button
					type="button"
					onclick={() => (showCreateModal = false)}
					class="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 text-sm"
				>
					✕
				</button>
			</div>

			<form
				method="POST"
				action="?/create"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						isSubmitting = false;
						showCreateModal = false;
						await update();
					};
				}}
				class="space-y-4"
			>
				<div>
					<label for="code" class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
						Coupon Code *
					</label>
					<input
						type="text"
						id="code"
						name="code"
						bind:value={newCode}
						required
						placeholder="e.g. VIP100, FOUNDER50"
						class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm font-mono uppercase text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
					/>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="discount_type" class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
							Discount Type *
						</label>
						<select
							id="discount_type"
							name="discount_type"
							bind:value={newDiscountType}
							class="w-full px-3 py-2.5 rounded-xl bg-[#18181f] border border-white/15 text-xs text-white focus:outline-none focus:border-blue-500"
						>
							<option value="percentage">% Percentage</option>
							<option value="fixed">₹ Fixed INR</option>
						</select>
					</div>

					<div>
						<label for="discount_value" class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
							Value * ({newDiscountType === 'percentage' ? '%' : '₹'})
						</label>
						<input
							type="number"
							id="discount_value"
							name="discount_value"
							bind:value={newDiscountValue}
							min="1"
							max={newDiscountType === 'percentage' ? 100 : undefined}
							required
							class="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/15 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
						/>
					</div>
				</div>

				{#if newDiscountType === 'percentage' && newDiscountValue === 100}
					<div class="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
						<span>🎁</span>
						<span>Grants 100% complimentary consultation waiver to clients using this code.</span>
					</div>
				{/if}

				<div>
					<label for="event_type_id" class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
						Applicable Service
					</label>
					<select
						id="event_type_id"
						name="event_type_id"
						bind:value={newEventTypeId}
						class="w-full px-3 py-2.5 rounded-xl bg-[#18181f] border border-white/15 text-xs text-white focus:outline-none focus:border-blue-500"
					>
						<option value="">All Consultation Services</option>
						{#each data.eventTypes as et}
							<option value={et.id}>{et.name}</option>
						{/each}
					</select>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="max_uses" class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
							Usage Limit
						</label>
						<input
							type="number"
							id="max_uses"
							name="max_uses"
							bind:value={newMaxUses}
							min="1"
							placeholder="Unlimited"
							class="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
						/>
					</div>

					<div>
						<label for="expires_at" class="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
							Expiration Date
						</label>
						<input
							type="date"
							id="expires_at"
							name="expires_at"
							bind:value={newExpiresAt}
							class="w-full px-3 py-2 rounded-xl bg-[#18181f] border border-white/15 text-xs text-white focus:outline-none focus:border-blue-500"
						/>
					</div>
				</div>

				<div class="pt-4 flex items-center justify-end gap-2 border-t border-white/10">
					<button
						type="button"
						onclick={() => (showCreateModal = false)}
						class="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="btn-electric py-2 px-5 rounded-xl text-xs font-bold disabled:opacity-50"
					>
						{isSubmitting ? 'Creating...' : 'Save Coupon'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
