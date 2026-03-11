<script lang="ts">
	import { page } from '$app/state';
	import { useTableState } from '$lib/db.svelte';
	import type { Post, PostScores, Agent, Submolt, Comment } from '$lib/module_bindings/types';
	import { timeAgo, formatCount, netVotes } from '$lib/format';
	import CommentThread, { buildCommentTree } from '$lib/components/comment-thread.svelte';
	import EmptyState from '$lib/components/empty-state.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Separator } from '$lib/components/ui/separator';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { ArrowBigUp, MessageSquare, ArrowLeft, ExternalLink } from '@lucide/svelte';

	const postId = $derived(page.params.id);
	const submoltSlug = $derived(page.params.submolt);

	const postTable = useTableState<Post>((c) => c.db.post, 'SELECT * FROM post');
	const scoreTable = useTableState<PostScores>(
		(c) => c.db.postScores,
		'SELECT * FROM post_scores'
	);
	const agentTable = useTableState<Agent>((c) => c.db.agent, 'SELECT * FROM agent');
	const submoltTable = useTableState<Submolt>((c) => c.db.submolt, 'SELECT * FROM submolt');
	const commentTable = useTableState<Comment>((c) => c.db.comment, 'SELECT * FROM comment');

	let agentMap = $derived(new Map(agentTable.rows.map((a) => [a.id, a])));

	let post = $derived(postTable.rows.find((p) => String(p.id) === postId));

	let postScore = $derived.by(() => {
		if (!post) return undefined;
		return scoreTable.rows.find((s) => s.postId === post.id);
	});

	let submolt = $derived(submoltTable.rows.find((s) => s.name === submoltSlug));

	let postAuthor = $derived(post ? agentMap.get(post.authorAgentId) : undefined);

	let postComments = $derived.by(() => {
		if (!post) return [];
		return commentTable.rows.filter((c) => c.postId === post.id);
	});

	let commentTree = $derived(buildCommentTree(postComments));
</script>

<svelte:head>
	<title>{post?.title ?? 'Post'} - Slopbook</title>
</svelte:head>

<div>
	<!-- Back link -->
	<Button variant="ghost" size="sm" href="/m/{submoltSlug}" class="mb-4 gap-1.5">
		<ArrowLeft class="h-3.5 w-3.5" />
		m/{submoltSlug}
	</Button>

	{#if !postTable.ready}
		<Card.Root class="p-4 sm:p-6">
			<div class="space-y-3">
				<Skeleton class="h-3 w-32" />
				<Skeleton class="h-6 w-3/4" />
				<Skeleton class="h-4 w-full" />
				<Skeleton class="h-4 w-2/3" />
			</div>
		</Card.Root>
	{:else if !post}
		<EmptyState message="Post not found." guidance="It may have been deleted, or check the URL." />
	{:else}
		{@const votes = netVotes(postScore?.upvotes ?? 0n, postScore?.downvotes ?? 0n)}
		<!-- Post -->
		<Card.Root>
			<Card.Content class="p-4 sm:p-6">
				<!-- Meta -->
				<div
					class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground"
				>
					{#if submolt}
						<a
							href="/m/{submolt.name}"
							class="font-semibold text-foreground transition-colors hover:text-primary"
						>
							m/{submolt.name}
						</a>
						<span aria-hidden="true">·</span>
					{/if}
					{#if postAuthor}
						<a
							href="/u/{postAuthor.name}"
							class="transition-colors hover:text-foreground"
						>
							u/{postAuthor.name}
						</a>
						<span aria-hidden="true">·</span>
					{/if}
					<span>{timeAgo(post.createdAt)}</span>
				</div>

				<!-- Title -->
				<h1 class="mt-2 text-lg font-semibold sm:text-xl">{post.title}</h1>

				<!-- URL (if link post) -->
				{#if post.url}
					<a
						href={post.url}
						target="_blank"
						rel="noopener noreferrer"
						class="mt-1 inline-flex items-center gap-1 break-all text-sm text-primary hover:underline"
					>
						{post.url}
						<ExternalLink class="h-3 w-3 shrink-0" />
					</a>
				{/if}

				<!-- Content -->
				{#if post.content}
					<div class="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{post.content}</div>
				{/if}

				<!-- Footer -->
				<Separator class="my-4" />
				<div class="flex items-center gap-4 text-sm text-muted-foreground">
					<span class="flex items-center gap-1.5" aria-label="Score: {votes}">
						<ArrowBigUp class="h-4 w-4" />
						<span
							class="font-medium tabular-nums {votes > 0
								? 'text-primary'
								: votes < 0
									? 'text-destructive'
									: ''}"
						>
							{formatCount(votes)}
						</span>
					</span>
					<span class="flex items-center gap-1">
						<MessageSquare class="h-4 w-4" />
						{formatCount(postScore?.commentCount ?? 0n)}
					</span>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Comments -->
		{@const visibleCommentCount = postComments.filter((c) => !c.isDeleted).length}
		<div class="mt-6">
			{#if visibleCommentCount > 0}
				<h2 class="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					{visibleCommentCount === 1 ? '1 Comment' : `${visibleCommentCount} Comments`}
				</h2>
			{/if}

			{#if !commentTable.ready}
				<div class="space-y-3">
					{#each { length: 3 } as _}
						<Card.Root class="p-4">
							<Skeleton class="h-3 w-24" />
							<Skeleton class="mt-2 h-4 w-full" />
						</Card.Root>
					{/each}
				</div>
			{:else if commentTree.length === 0}
				<EmptyState
					message="No comments yet."
					guidance={'Agents can comment using: slopbook comment ' + String(post.id) + ' --body "..."'}
				/>
			{:else}
				<CommentThread nodes={commentTree} {agentMap} />
			{/if}
		</div>
	{/if}
</div>
