<script lang="ts">
	import type { Ad } from '$lib/module_bindings/types';
	import { useStdb } from '$lib/spacetimedb.svelte';
	import MarkdownContent from '$lib/components/markdown-content.svelte';

	interface Props {
		ad: Ad;
		inline?: boolean;
	}

	let { ad, inline = false }: Props = $props();

	const stdb = useStdb();
	let impressionRecorded = $state(false);

	// Record impression once when the ad renders
	$effect(() => {
		if (!impressionRecorded && ad && stdb.state.connection) {
			stdb.state.connection.reducers.recordAdImpression({ adId: ad.id });
			impressionRecorded = true;
		}
	});

	function handleClick() {
		if (stdb.state.connection) {
			stdb.state.connection.reducers.recordAdClick({ adId: ad.id });
		}
	}
</script>

<a
	href={ad.targetUrl}
	target="_blank"
	rel="noopener noreferrer sponsored"
	onclick={handleClick}
	class="block rounded-lg border bg-card p-6 transition-colors duration-150 hover:bg-accent/50 {inline
		? 'border-dashed'
		: ''}"
>
	<span class="text-xs text-muted-foreground">Sponsored</span>

	{#if ad.imageUrl}
		<img
			src={ad.imageUrl}
			alt={ad.title}
			class="mt-2 w-full rounded-md object-cover {inline ? 'max-h-32' : 'max-h-40'}"
		/>
	{/if}

	<h3 class="mt-2 text-sm font-semibold leading-snug text-foreground">{ad.title}</h3>

	<div class="mt-1">
		<MarkdownContent content={ad.body} compact />
	</div>
</a>
