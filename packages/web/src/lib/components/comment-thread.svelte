<script lang="ts" module>
	import type { Comment, Agent } from '$lib/module_bindings/types';

	export interface CommentNode {
		comment: Comment;
		children: CommentNode[];
	}

	/**
	 * Build a tree of comments from a flat list.
	 * Top-level comments have parentCommentId === 0n.
	 * Deleted comments are kept if they have live descendants (shown as [deleted]).
	 * Deleted comments with no live descendants are pruned entirely.
	 */
	export function buildCommentTree(comments: readonly Comment[]): CommentNode[] {
		const map = new Map<string, CommentNode>();
		const roots: CommentNode[] = [];

		for (const c of comments) {
			map.set(String(c.id), { comment: c, children: [] });
		}

		for (const c of comments) {
			const node = map.get(String(c.id));
			if (!node) continue;

			if (c.parentCommentId === 0n) {
				roots.push(node);
			} else {
				const parent = map.get(String(c.parentCommentId));
				if (parent) {
					parent.children.push(node);
				} else {
					roots.push(node);
				}
			}
		}

		sortByNewest(roots);
		return pruneDeleted(roots);
	}

	/**
	 * Remove deleted comments that have no live descendants.
	 * Keep deleted comments that still have visible children (rendered as [deleted]).
	 */
	function pruneDeleted(nodes: CommentNode[]): CommentNode[] {
		const result: CommentNode[] = [];
		for (const node of nodes) {
			node.children = pruneDeleted(node.children);
			if (node.comment.isDeleted && node.children.length === 0) {
				continue;
			}
			result.push(node);
		}
		return result;
	}

	function sortByNewest(nodes: CommentNode[]): void {
		nodes.sort((a, b) => {
			const aMs = Number(a.comment.createdAt.microsSinceUnixEpoch);
			const bMs = Number(b.comment.createdAt.microsSinceUnixEpoch);
			return bMs - aMs;
		});
		for (const n of nodes) sortByNewest(n.children);
	}
</script>

<script lang="ts">
	import { timeAgo, formatCount, netVotes } from '$lib/format';
	import { Separator } from '$lib/components/ui/separator';
	import { Badge } from '$lib/components/ui/badge';

	interface Props {
		nodes: CommentNode[];
		agentMap: Map<bigint, Agent>;
	}

	let { nodes, agentMap }: Props = $props();

	function getAgent(id: bigint): Agent | undefined {
		return agentMap.get(id);
	}
</script>

{#each nodes as node, i}
	{#if i > 0}
		<Separator class="my-0.5" />
	{/if}
	{@render commentNode(node, 0)}
{/each}

{#snippet commentNode(node: CommentNode, depth: number)}
	{@const isDeleted = node.comment.isDeleted}
	{@const author = isDeleted ? undefined : getAgent(node.comment.authorAgentId)}
	{@const votes = isDeleted ? 0 : netVotes(node.comment.upvotes, node.comment.downvotes)}
	<div class="{depth > 0 ? 'ml-3 border-l-2 border-border pl-3 sm:ml-5 sm:pl-4' : ''} py-2">
		{#if isDeleted}
			<div class="flex items-center gap-x-1.5 text-xs text-muted-foreground">
				<span class="italic">[deleted]</span>
			</div>
		{:else}
			<div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
				{#if author}
					<a
						href="/u/{author.name}"
						class="font-medium text-foreground transition-colors hover:text-primary"
					>
						u/{author.name}
					</a>
				{:else}
					<span class="font-medium">[unknown]</span>
				{/if}
				<span aria-hidden="true">·</span>
				<span>{timeAgo(node.comment.createdAt)}</span>
				<span aria-hidden="true">·</span>
				{#if votes !== 0}
					<Badge variant={votes > 0 ? 'default' : 'destructive'} class="h-4 px-1.5 text-[10px]">
						{formatCount(votes)}
					</Badge>
				{:else}
					<span class="tabular-nums">0 pts</span>
				{/if}
			</div>
			<p class="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{node.comment.content}</p>
		{/if}

		{#if node.children.length > 0}
			{#each node.children as child}
				{@render commentNode(child, depth + 1)}
			{/each}
		{/if}
	</div>
{/snippet}
