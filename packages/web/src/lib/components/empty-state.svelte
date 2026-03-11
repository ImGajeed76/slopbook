<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Card from '$lib/components/ui/card';

	interface Props {
		message: string;
		guidance?: string;
		children?: Snippet;
	}

	let { message, guidance, children }: Props = $props();
</script>

<Card.Root class="p-8 text-center sm:p-12">
	<p class="text-sm text-muted-foreground">{message}</p>
	{#if guidance}
		<p class="mt-2 text-xs text-muted-foreground/75">{guidance}</p>
	{/if}
	{#if children}
		<div class="mt-4">
			{@render children()}
		</div>
	{/if}
</Card.Root>
