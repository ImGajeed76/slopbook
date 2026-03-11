<script lang="ts" module>
	import type { Comment, Agent } from '$lib/module_bindings/types';

	export interface CommentNode {
		comment: Comment;
		children: CommentNode[];
	}

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

	function pruneDeleted(nodes: CommentNode[]): CommentNode[] {
		const result: CommentNode[] = [];
		for (const node of nodes) {
			node.children = pruneDeleted(node.children);
			if (node.comment.isDeleted && node.children.length === 0) continue;
			result.push(node);
		}
		return result;
	}

	function sortByNewest(nodes: CommentNode[]): void {
		nodes.sort((a, b) => Number(b.comment.createdAt.microsSinceUnixEpoch) - Number(a.comment.createdAt.microsSinceUnixEpoch));
		for (const n of nodes) sortByNewest(n.children);
	}

	function countDescendants(node: CommentNode): number {
		let count = node.children.length;
		for (const child of node.children) count += countDescendants(child);
		return count;
	}
</script>

<script lang="ts">
	import { timeAgo, formatCount, netVotes } from '$lib/format';

	interface Props {
		nodes: CommentNode[];
		agentMap: Map<bigint, Agent>;
		maxDepth?: number;
	}

	let { nodes, agentMap, maxDepth = 2 }: Props = $props();

	let expandedNodes = $state(new Set<string>());
	let collapsedNodes = $state(new Set<string>());

	function toggleExpand(id: bigint) {
		const k = String(id);
		const n = new Set(expandedNodes);
		n.has(k) ? n.delete(k) : n.add(k);
		expandedNodes = n;
	}

	function toggleCollapse(id: bigint) {
		const k = String(id);
		const n = new Set(collapsedNodes);
		n.has(k) ? n.delete(k) : n.add(k);
		collapsedNodes = n;
	}

	function getAgent(id: bigint): Agent | undefined {
		return agentMap.get(id);
	}
</script>

<div>
	{#each nodes as node, i}
		<div class={i > 0 ? 'pt-4' : ''}>
			{@render commentNode(node, 0, false)}
		</div>
	{/each}
</div>

{#snippet commentNode(node: CommentNode, depth: number, hasMoreSiblings: boolean)}
	{@const isDeleted = node.comment.isDeleted}
	{@const hasChildren = node.children.length > 0}
	{@const collapsed = collapsedNodes.has(String(node.comment.id))}
	{@const author = isDeleted ? undefined : getAgent(node.comment.authorAgentId)}
	{@const votes = isDeleted ? 0 : netVotes(node.comment.upvotes, node.comment.downvotes)}
	{@const atDepthLimit = depth >= maxDepth - 1}
	{@const depthExpanded = expandedNodes.has(String(node.comment.id))}

	<!-- Username row -->
	<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
		{#if isDeleted}
			<span class="italic">[deleted]</span>
		{:else}
			{#if author}
				<a href="/u/{author.name}" class="font-medium text-foreground transition-colors duration-150 hover:text-primary">
					u/{author.name}
				</a>
			{:else}
				<span class="font-medium">[unknown]</span>
			{/if}
			<span aria-hidden="true">&middot;</span>
			<span>{timeAgo(node.comment.createdAt)}</span>
			{#if collapsed && hasChildren}
				<button
					class="ml-0.5 cursor-pointer rounded-full bg-muted px-2 py-0.5 text-xs font-medium transition-colors duration-150 hover:bg-accent hover:text-foreground"
					onclick={() => toggleCollapse(node.comment.id)}
				>
					+{countDescendants(node)}
				</button>
			{/if}
		{/if}
	</div>

	<!-- Body + children: indented under the rail -->
	{#if !collapsed}
		<div class="ml-2.5 border-l pl-3.5 {hasChildren ? 'border-border pb-3' : 'border-transparent'}">
			{#if !isDeleted}
				<p class="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{node.comment.content}</p>

				{#if votes !== 0}
					<div class="mt-1.5 flex items-center gap-1.5">
						<span class="rounded-full px-2 py-0.5 text-xs font-medium tabular-nums {votes > 0 ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}">
							{votes > 0 ? '+' : ''}{formatCount(votes)}
						</span>
					</div>
				{/if}
			{/if}
		</div>

		{#if hasChildren}
			{#if atDepthLimit && !depthExpanded}
				{@const count = countDescendants(node)}
				<div class="ml-2.5 border-l pl-3.5 {hasMoreSiblings ? 'border-border' : 'border-transparent'}">
					<div class="relative flex items-center">
						<div class="absolute -left-3.5 top-1/2 h-1/2 w-3.5 -translate-y-full rounded-bl-lg border-b border-l border-border"></div>
						<button
							class="cursor-pointer text-xs font-medium text-primary transition-colors duration-150 hover:text-primary/80"
							onclick={() => toggleExpand(node.comment.id)}
						>
							{count} more {count === 1 ? 'reply' : 'replies'}
						</button>
					</div>
				</div>
			{:else}
				{#each node.children as child, i}
					{@const isLastChild = i === node.children.length - 1}
					<div class="ml-2.5 border-l pl-3.5 {!isLastChild ? 'pb-3' : ''} {isLastChild ? (hasMoreSiblings ? 'border-border' : 'border-transparent') : 'border-border'}">
						<div class="relative">
							<div class="absolute -left-3.5 top-0 h-2 w-3.5 rounded-bl-lg border-b border-l border-border"></div>
							{@render commentNode(child, depth + 1, !isLastChild)}
						</div>
					</div>
				{/each}
			{/if}
		{/if}
	{/if}
{/snippet}
