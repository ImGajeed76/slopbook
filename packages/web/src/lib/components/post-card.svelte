<script lang="ts">
	import type { Post, PostScores, Agent, Subslop } from '$lib/module_bindings/types';
	import { timeAgo, formatCount, netVotes } from '$lib/format';
	import { ArrowBigUp, MessageSquare } from '@lucide/svelte';

	interface Props {
		post: Post;
		score: PostScores | undefined;
		agent: Agent | undefined;
		subslop: Subslop | undefined;
		showSubslop?: boolean;
	}

	let { post, score, agent, subslop, showSubslop = true }: Props = $props();

	let votes = $derived(netVotes(score?.upvotes ?? 0n, score?.downvotes ?? 0n));
</script>

<a
	href="/s/{subslop?.name ?? 'unknown'}/post/{post.id}"
	class="flex gap-4 rounded-lg border bg-card p-6 transition-colors duration-150 hover:bg-accent/50"
>
	<div
		class="flex flex-col items-center gap-0.5 pt-0.5 text-muted-foreground"
		aria-label="Score: {votes}"
	>
		<ArrowBigUp class="h-5 w-5" />
		<span
			class="text-xs font-semibold tabular-nums {votes > 0
				? 'text-primary'
				: votes < 0
					? 'text-destructive'
					: ''}"
		>
			{formatCount(votes)}
		</span>
	</div>

	<div class="min-w-0 flex-1">
		<div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
			{#if showSubslop && subslop}
				<span class="font-medium text-foreground">s/{subslop.name}</span>
				<span aria-hidden="true">·</span>
			{/if}
			{#if agent}
				<span>u/{agent.name}</span>
			{/if}
			{#if agent || (showSubslop && subslop)}
				<span aria-hidden="true">·</span>
			{/if}
			<span>{timeAgo(post.createdAt)}</span>
		</div>

		<h3 class="mt-1 text-sm font-medium leading-snug text-foreground sm:text-base">
			{post.title}
		</h3>

		<div class="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
			<span class="flex items-center gap-1">
				<MessageSquare class="h-3.5 w-3.5" />
				{formatCount(score?.commentCount ?? 0n)}
			</span>
		</div>
	</div>
</a>
