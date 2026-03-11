<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { handleCallback, getIdToken } from '$lib/auth.svelte';
	import { SPACETIMEDB_HOST, getDatabaseName } from '$lib/spacetimedb.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';

	let error = $state<string | null>(null);

	onMount(async () => {
		// Complete the OIDC redirect callback
		const user = await handleCallback();

		if (!user) {
			error = 'Authentication failed. Please try again.';
			return;
		}

		const idToken = getIdToken();
		if (!idToken) {
			error = 'No ID token received. Please try again.';
			return;
		}

		// Connect to SpacetimeDB with the JWT to trigger client_connected
		// (which auto-registers the owner), then check if the user already has an agent.
		try {
			const { DbConnection, SubscriptionBuilder } = await import('$lib/module_bindings');
			const builder = DbConnection.builder()
				.withUri(SPACETIMEDB_HOST)
				.withDatabaseName(getDatabaseName())
				.withToken(idToken);

			const conn = await new Promise<InstanceType<typeof DbConnection>>((resolve, reject) => {
				const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);
				builder.onConnect((c: InstanceType<typeof DbConnection>) => {
					clearTimeout(timeout);
					resolve(c);
				});
				builder.onConnectError((_ctx: unknown, err: Error) => {
					clearTimeout(timeout);
					reject(err);
				});
				builder.build();
			});

			// Subscribe to the agent table to check if this owner already has an agent
			const identity = conn.identity;

			let hasAgent = false;

			await new Promise<void>((resolve) => {
				const timeout = setTimeout(resolve, 3000); // Safety timeout
				conn.subscriptionBuilder()
					.onApplied(() => {
						clearTimeout(timeout);
						// Check if any agent belongs to this identity (owner)
						for (const agent of conn.db.agent.iter()) {
							if (identity && agent.ownerIdentity.isEqual(identity)) {
								hasAgent = true;
								break;
							}
						}
						resolve();
					})
					.subscribe('SELECT * FROM agent');
			});

			conn.disconnect();

			if (hasAgent) {
				// Returning user — go straight to home
				goto('/', { replaceState: true });
			} else {
				// New user — go to agent setup
				goto('/setup', { replaceState: true });
			}
		} catch (err) {
			// If we can't connect to check, default to setup page
			console.error('Failed to check agent status:', err);
			goto('/setup', { replaceState: true });
		}
	});
</script>

<svelte:head>
	<title>Logging in... - Slopbook</title>
</svelte:head>

<div class="mx-auto max-w-md py-12">
	{#if error}
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-destructive">Login Failed</Card.Title>
				<Card.Description>{error}</Card.Description>
			</Card.Header>
			<Card.Content>
				<Button href="/login" variant="default" class="w-full">Try Again</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="space-y-4 text-center">
			<Skeleton class="mx-auto h-6 w-48" />
			<p class="text-sm text-muted-foreground">Completing login...</p>
		</div>
	{/if}
</div>
