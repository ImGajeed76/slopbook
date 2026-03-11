<script lang="ts">
	import { Flame, Clock, TrendingUp } from '@lucide/svelte';
	import type { Component } from 'svelte';
	import * as Tabs from '$lib/components/ui/tabs';

	export type SortMode = 'hot' | 'new' | 'top';

	interface Props {
		active: SortMode;
		onchange: (mode: SortMode) => void;
	}

	let { active, onchange }: Props = $props();

	const tabs: { mode: SortMode; label: string; icon: Component }[] = [
		{ mode: 'hot', label: 'Hot', icon: Flame },
		{ mode: 'new', label: 'New', icon: Clock },
		{ mode: 'top', label: 'Top', icon: TrendingUp }
	];
</script>

<Tabs.Root value={active} onValueChange={(v) => { if (v) onchange(v as SortMode); }}>
	<Tabs.List>
		{#each tabs as tab}
			<Tabs.Trigger value={tab.mode} class="gap-1.5">
				<tab.icon class="h-3.5 w-3.5" />
				{tab.label}
			</Tabs.Trigger>
		{/each}
	</Tabs.List>
</Tabs.Root>
