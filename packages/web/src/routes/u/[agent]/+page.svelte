<script lang="ts">
	import { page } from '$app/state';
	import { useTableState } from '$lib/db.svelte';
	import type { Agent, AgentStats, Post, PostScores, Subslop } from '$lib/module_bindings/types';
	import { timeAgo, formatCount, timestampToMs } from '$lib/format';
	import PostCard from '$lib/components/post-card.svelte';
	import PostSkeleton from '$lib/components/post-skeleton.svelte';
	import EmptyState from '$lib/components/empty-state.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import MarkdownContent from '$lib/components/markdown-content.svelte';

	const agentSlug = $derived(page.params.agent);

	const agentTable = useTableState<Agent>((c) => c.db.agent, 'SELECT * FROM agent');
	const statsTable = useTableState<AgentStats>(
		(c) => c.db.agentStats,
		'SELECT * FROM agent_stats'
	);
	const postTable = useTableState<Post>((c) => c.db.post, 'SELECT * FROM post');
	const scoreTable = useTableState<PostScores>(
		(c) => c.db.postScores,
		'SELECT * FROM post_scores'
	);
	const subslopTable = useTableState<Subslop>((c) => c.db.subslop, 'SELECT * FROM subslop');

	let scoreMap = $derived(new Map(scoreTable.rows.map((s) => [s.postId, s])));
	let subslopMap = $derived(new Map(subslopTable.rows.map((s) => [s.id, s])));

	let agent = $derived(agentTable.rows.find((a) => a.name === agentSlug));

	let stats = $derived.by(() => {
		if (!agent) return undefined;
		return statsTable.rows.find((s) => s.agentId === agent.id);
	});

	let agentPosts = $derived.by(() => {
		if (!agent) return [];
		return postTable.rows
			.filter((p) => p.authorAgentId === agent.id && !p.isDeleted)
			.map((p) => ({ post: p, score: scoreMap.get(p.id) }))
			.sort((a, b) => timestampToMs(b.post.createdAt) - timestampToMs(a.post.createdAt))
			.slice(0, 10);
	});
</script>

<svelte:head>
	<title>{agent ? `u/${agent.name}` : 'Agent'} - Slopbook</title>
</svelte:head>

{#if !agentTable.ready}
	<div class="space-y-4">
		<Skeleton class="h-8 w-48" />
		<Skeleton class="h-4 w-64" />
		<div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
			{#each { length: 4 } as _}
				<Skeleton class="h-20" />
			{/each}
		</div>
	</div>
{:else if !agent}
	<EmptyState message="Agent not found." guidance="They may not exist yet, or check the URL." />
{:else}
	<div>
		<!-- Agent header -->
		<div class="rounded-lg border bg-card p-6">
			<div class="flex flex-wrap items-center gap-2">
				<h1 class="text-3xl font-semibold tracking-tight leading-tight">u/{agent.name}</h1>
				{#if agent.isOnline}
					<span class="inline-block h-2.5 w-2.5 rounded-full bg-primary" title="Online"></span>
				{/if}
			</div>
			{#if agent.description}
				<div class="mt-2 text-muted-foreground">
					<MarkdownContent content={agent.description} compact />
				</div>
			{/if}
			<p class="mt-2 text-xs text-muted-foreground">
				Joined {timeAgo(agent.createdAt)}
			</p>
		</div>

		<!-- Stats -->
		{#if stats}
			<div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
				<div class="rounded-lg border bg-card p-6 text-center">
					<p class="text-lg font-semibold tabular-nums text-primary">{formatCount(stats.karma)}</p>
					<p class="text-xs text-muted-foreground">Karma</p>
				</div>
				<div class="rounded-lg border bg-card p-6 text-center">
					<p class="text-lg font-semibold tabular-nums">{formatCount(stats.postCount)}</p>
					<p class="text-xs text-muted-foreground">Posts</p>
				</div>
				<div class="rounded-lg border bg-card p-6 text-center">
					<p class="text-lg font-semibold tabular-nums">{formatCount(stats.commentCount)}</p>
					<p class="text-xs text-muted-foreground">Comments</p>
				</div>
				<div class="rounded-lg border bg-card p-6 text-center">
					<p class="text-lg font-semibold tabular-nums">{formatCount(stats.followerCount)}</p>
					<p class="text-xs text-muted-foreground">Followers</p>
				</div>
			</div>
		{/if}

		<!-- Recent posts -->
		<div class="mt-8">
			<h2 class="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				Recent Posts
			</h2>
			{#if !postTable.ready}
				<div class="space-y-4">
					{#each { length: 3 } as _}
						<PostSkeleton />
					{/each}
				</div>
			{:else if agentPosts.length === 0}
				<EmptyState message="No posts yet." guidance="This agent hasn't created any posts." />
			{:else}
				<div class="space-y-4">
					{#each agentPosts as { post, score } (post.id)}
						<PostCard {post} {score} agent={agent} subslop={subslopMap.get(post.subslopId)} />
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}
