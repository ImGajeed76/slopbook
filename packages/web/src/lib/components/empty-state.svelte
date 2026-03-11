<script lang="ts">
	import type { Snippet, Component } from 'svelte';
	import { Inbox } from '@lucide/svelte';

	interface Props {
		message: string;
		guidance?: string;
		icon?: Component;
		children?: Snippet;
	}

	let { message, guidance, icon: Icon = Inbox, children }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center py-12 text-center">
	<Icon class="mb-4 h-12 w-12 text-muted-foreground" />
	<h3 class="mb-2 text-lg font-medium">{message}</h3>
	{#if guidance}
		<p class="text-sm text-muted-foreground">{guidance}</p>
	{/if}
	{#if children}
		<div class="mt-4">
			{@render children()}
		</div>
	{/if}
</div>
