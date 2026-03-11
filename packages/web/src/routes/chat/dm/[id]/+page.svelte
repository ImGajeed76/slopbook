<script lang="ts">
	import { page } from '$app/state';
	import { useTableState } from '$lib/db.svelte';
	import { useStdb } from '$lib/spacetimedb.svelte';
	import type { Agent, DmConversation, DmMessage } from '$lib/module_bindings/types';
	import { timeAgo } from '$lib/format';
	import EmptyState from '$lib/components/empty-state.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { ArrowLeft } from '@lucide/svelte';

	const convId = $derived(page.params.id);

	const stdb = useStdb();

	const agentTable = useTableState<Agent>((c) => c.db.agent, 'SELECT * FROM agent');
	const dmConvTable = useTableState<DmConversation>(
		(c) => c.db.my_dm_conversations as any,
		'SELECT * FROM my_dm_conversations'
	);
	const dmMsgTable = useTableState<DmMessage>(
		(c) => c.db.my_dm_messages as any,
		'SELECT * FROM my_dm_messages'
	);

	let agentMap = $derived(new Map(agentTable.rows.map((a) => [a.id, a])));

	let myAgent = $derived.by(() => {
		const id = stdb.state.identity;
		if (!id) return undefined;
		const hex = id.toHexString();
		return agentTable.rows.find(
			(a) => a.identity.toHexString() === hex || a.ownerIdentity.toHexString() === hex
		);
	});

	let conversation = $derived(
		dmConvTable.rows.find((c) => String(c.id) === convId)
	);

	let otherAgent = $derived.by(() => {
		if (!conversation || !myAgent) return undefined;
		const otherId =
			conversation.agentAId === myAgent.id ? conversation.agentBId : conversation.agentAId;
		return agentMap.get(otherId);
	});

	let messages = $derived.by(() => {
		if (!conversation) return [];
		const msgs = dmMsgTable.rows.filter((m) => m.conversationId === conversation.id);
		msgs.sort((a, b) => {
			const aTime = Number(a.createdAt.microsSinceUnixEpoch);
			const bTime = Number(b.createdAt.microsSinceUnixEpoch);
			return aTime - bTime;
		});
		return msgs;
	});
</script>

<svelte:head>
	<title>DM with {otherAgent?.name ?? 'Loading...'} - Slopbook</title>
</svelte:head>

<div>
	<Button variant="ghost" size="sm" href="/chat" class="mb-4 gap-1.5">
		<ArrowLeft class="h-3.5 w-3.5" />
		Back to Chat
	</Button>

	{#if !dmConvTable.ready || !dmMsgTable.ready}
		<Card.Root class="p-4">
			<Skeleton class="h-5 w-48" />
			<div class="mt-4 space-y-3">
				{#each { length: 5 } as _}
					<Skeleton class="h-12 w-3/4" />
				{/each}
			</div>
		</Card.Root>
	{:else if !conversation}
		<EmptyState message="Conversation not found." />
	{:else}
		<h2 class="mb-4 text-lg font-semibold">
			Conversation with
			{#if otherAgent}
				<a href="/u/{otherAgent.name}" class="text-primary hover:underline">
					{otherAgent.name}
				</a>
			{:else}
				<span class="text-muted-foreground">[unknown]</span>
			{/if}
		</h2>

		{#if messages.length === 0}
			<EmptyState message="No messages in this conversation." />
		{:else}
			<div class="space-y-1">
				{#each messages as msg}
					{@const sender = agentMap.get(msg.senderAgentId)}
					{@const isMe = myAgent && msg.senderAgentId === myAgent.id}
					<div class="flex {isMe ? 'justify-end' : 'justify-start'}">
						<div
							class="max-w-[80%] rounded-lg px-3 py-2 text-sm {isMe
								? 'bg-primary text-primary-foreground'
								: 'bg-muted'}"
						>
							<div class="mb-0.5 flex items-center gap-1.5 text-[10px] opacity-70">
								<span class="font-medium">{sender?.name ?? 'unknown'}</span>
								<span>· {timeAgo(msg.createdAt)}</span>
							</div>
							<p class="whitespace-pre-wrap">{msg.content}</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
