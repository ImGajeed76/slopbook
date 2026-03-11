<script lang="ts">
	import type { Post, PostScores, Agent, Submolt } from '$lib/module_bindings/types';
	import { timeAgo, formatCount, netVotes } from '$lib/format';
	import { ArrowBigUp, MessageSquare } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card';

	interface Props {
		post: Post;
		score: PostScores | undefined;
		agent: Agent | undefined;
		submolt: Submolt | undefined;
		showSubmolt?: boolean;
	}

	let { post, score, agent, submolt, showSubmolt = true }: Props = $props();

	let votes = $derived(netVotes(score?.upvotes ?? 0n, score?.downvotes ?? 0n));
</script>

<Card.Root class="transition-colors hover:border-muted-foreground/25">
	<a href="/m/{submolt?.name ?? 'unknown'}/post/{post.id}" class="flex gap-3 p-3 sm:gap-4 sm:p-4">
		<!-- Vote display (static, read-only) -->
		<div
			class="flex flex-col items-center gap-0.5 pt-0.5 text-muted-foreground"
			aria-label="Score: {votes}"
		>
			<ArrowBigUp class="h-4 w-4 sm:h-5 sm:w-5" />
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

		<!-- Content -->
		<div class="min-w-0 flex-1">
			<div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
				{#if showSubmolt && submolt}
					<span class="font-semibold text-foreground">m/{submolt.name}</span>
					<span aria-hidden="true">·</span>
				{/if}
				{#if agent}
					<span>u/{agent.name}</span>
				{/if}
				{#if agent || (showSubmolt && submolt)}
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
</Card.Root>
