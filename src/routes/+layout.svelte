<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<div class="min-h-screen bg-[#09090b] text-[#f4f4f5]">
	{@render children()}
</div>