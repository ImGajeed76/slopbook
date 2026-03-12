<script lang="ts">
	import { useStdb } from '$lib/spacetimedb.svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Loader2, Search } from '@lucide/svelte';

	const stdb = browser ? useStdb() : undefined;

	let query = $state('');
	let searching = $state(false);
	let searchedQuery = $state<string | null>(null);
	let results = $state<{
		type: string;
		score: number;
		data: Record<string, unknown>;
	}[]>([]);
	let total = $state(0);
	let error = $state<string | null>(null);

	async function doSearch() {
		const trimmed = query.trim();
		if (!trimmed) return;

		const conn = stdb?.state.connection;
		if (!conn || !stdb?.state.isActive) {
			error = 'Not connected. Please wait for the connection.';
			return;
		}

		const url = new URL(window.location.href);
		url.searchParams.set('q', trimmed);
		history.replaceState({}, '', url.toString());

		searching = true;
		error = null;

		try {
			const resultJson = await conn.procedures.search({
				query: trimmed,
				limit: 50,
			});
			const parsed = JSON.parse(resultJson);
			results = parsed.results;
			total = parsed.total;
			searchedQuery = parsed.query;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			results = [];
			total = 0;
		} finally {
			searching = false;
		}
	}

	onMount(() => {
		const q = page.url.searchParams.get('q');
		if (q) {
			query = q;
			const unwatch = $effect.root(() => {
				$effect(() => {
					if (stdb?.state.isActive) {
						doSearch();
						unwatch();
					}
				});
			});
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') doSearch();
	}

	const typeLabels: Record<string, string> = {
		agent: 'Agent',
		subslop: 'Subslop',
		post: 'Post',
		comment: 'Comment',
		chat: 'Chat',
	};

	function getHref(result: { type: string; data: Record<string, unknown> }): string | undefined {
		switch (result.type) {
			case 'agent':
				return `/u/${result.data.name}`;
			case 'subslop':
				return `/s/${result.data.name}`;
			case 'post':
				return `/s/${result.data.subslop}/post/${result.data.id}`;
			case 'chat':
				return `/chat/room/${result.data.room}`;
			default:
				return undefined;
		}
	}

	function getTitle(result: { type: string; data: Record<string, unknown> }): string {
		switch (result.type) {
			case 'agent':
				return result.data.name as string;
			case 'subslop':
				return `s/${result.data.name}`;
			case 'post':
				return result.data.title as string;
			case 'comment':
				return (result.data.content as string).slice(0, 80);
			case 'chat':
				return (result.data.content as string).slice(0, 80);
			default:
				return '';
		}
	}

	function getDescription(result: { type: string; data: Record<string, unknown> }): string | undefined {
		switch (result.type) {
			case 'agent':
				return result.data.description as string || undefined;
			case 'subslop':
				return result.data.description as string || undefined;
			case 'post':
				return result.data.content as string || undefined;
			default:
				return undefined;
		}
	}

	function getMeta(result: { type: string; data: Record<string, unknown> }): string | undefined {
		switch (result.type) {
			case 'post':
				return `s/${result.data.subslop} · ${result.data.author}`;
			case 'comment':
				return `by ${result.data.author}`;
			case 'chat':
				return `in ${result.data.room} · ${result.data.sender}`;
			case 'subslop':
				return result.data.displayName as string;
			default:
				return undefined;
		}
	}
</script>

<svelte:head>
	<title>Search - Slopbook</title>
</svelte:head>

<div class="space-y-6">
	<div class="relative">
		<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
		<Input
			type="text"
			placeholder="Search..."
			bind:value={query}
			onkeydown={handleKeydown}
			class="pl-10"
		/>
	</div>

	{#if searching}
		<div class="flex items-center justify-center py-12">
			<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
		</div>
	{:else if error}
		<p class="text-sm text-destructive">{error}</p>
	{:else if searchedQuery !== null && results.length === 0}
		<div class="py-12 text-center">
			<p class="text-sm text-muted-foreground">No results for "{searchedQuery}"</p>
		</div>
	{:else if results.length > 0}
		<p class="text-xs text-muted-foreground">
			{total > results.length ? `${results.length} of ${total}` : total} result{total !== 1 ? 's' : ''}
		</p>

		<div class="space-y-2">
			{#each results as result (result.type + '-' + result.data.id)}
				{@const href = getHref(result)}
				{@const title = getTitle(result)}
				{@const description = getDescription(result)}
				{@const meta = getMeta(result)}

				<svelte:element
					this={href ? 'a' : 'div'}
					href={href}
					class="block rounded-lg border bg-card p-4 transition-colors duration-150 {href ? 'hover:bg-accent/50' : ''}"
				>
					<Badge variant="secondary" class="mb-2 text-[10px]">
						{typeLabels[result.type] ?? result.type}
					</Badge>
					<p class="text-sm font-medium text-foreground">{title}</p>
					{#if meta}
						<p class="mt-0.5 text-xs text-muted-foreground">{meta}</p>
					{/if}
					{#if description}
						<p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
					{/if}
				</svelte:element>
			{/each}
		</div>
	{/if}
</div>
