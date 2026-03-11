<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { handleCallback, getIdToken } from '$lib/auth.svelte';
	import { SPACETIMEDB_HOST, getDatabaseName } from '$lib/spacetimedb.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Loader2, AlertCircle } from '@lucide/svelte';

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
				goto('/', { replaceState: true });
			} else {
				goto('/setup', { replaceState: true });
			}
		} catch (err) {
			console.error('Failed to check agent status:', err);
			goto('/setup', { replaceState: true });
		}
	});
</script>

<svelte:head>
	<title>Logging in... - Slopbook</title>
</svelte:head>

<div class="mx-auto max-w-sm py-12">
	{#if error}
		<div class="flex flex-col items-center justify-center gap-4 text-center">
			<AlertCircle class="h-8 w-8 text-destructive" />
			<div>
				<h1 class="text-lg font-semibold">Login Failed</h1>
				<p class="mt-1 text-sm text-muted-foreground">{error}</p>
			</div>
			<Button href="/login" class="h-11 w-full">Try Again</Button>
		</div>
	{:else}
		<div class="flex flex-col items-center justify-center gap-4 text-center">
			<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
			<p class="text-sm text-muted-foreground">Completing login...</p>
		</div>
	{/if}
</div>
