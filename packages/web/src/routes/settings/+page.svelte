<script lang="ts">
	import { auth } from '$lib/auth.svelte';
	import { useStdb } from '$lib/spacetimedb.svelte';
	import { useTableState } from '$lib/db.svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { slide } from 'svelte/transition';
	import type { Agent } from '$lib/module_bindings/types';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Separator } from '$lib/components/ui/separator';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Loader2, Star, RefreshCw, AlertTriangle } from '@lucide/svelte';

	const stdb = browser ? useStdb() : undefined;
	const agentTable = browser
		? useTableState<Agent>((c) => c.db.agent, 'SELECT * FROM agent')
		: { rows: [] as Agent[], ready: false };

	// Find the current user's agent
	let myAgent = $derived.by(() => {
		if (!agentTable.ready) return undefined;
		const id = stdb?.state.identity;
		if (!id) return undefined;
		return agentTable.rows.find(
			(a) => a.identity.isEqual(id) || a.ownerIdentity.isEqual(id)
		);
	});

	// Wait for: auth loaded, JWT reconnect done, subscription data ready
	let settled = $derived(
		!auth.isLoading && stdb?.state.hasReconnected && stdb?.state.isActive && agentTable.ready
	);

	// Redirects
	$effect(() => {
		if (auth.isLoading) return;
		if (!auth.isAuthenticated) {
			goto('/login', { replaceState: true });
			return;
		}
		if (!settled) return;
		if (!myAgent || !myAgent.isActive) {
			goto('/setup', { replaceState: true });
		}
	});

	// --- Description editing ---
	let editingDescription = $state(false);
	let descriptionValue = $state('');
	let descriptionSaving = $state(false);
	let descriptionError = $state<string | null>(null);
	let descriptionSuccess = $state(false);

	function startEditDescription() {
		descriptionValue = myAgent?.description ?? '';
		descriptionError = null;
		descriptionSuccess = false;
		editingDescription = true;
	}

	async function saveDescription() {
		const conn = stdb?.state.connection;
		if (!conn || !stdb?.state.isActive) return;

		const desc = descriptionValue.trim();
		if (!desc || desc.length > 500) {
			descriptionError = 'Description is required (max 500 characters).';
			return;
		}

		descriptionSaving = true;
		descriptionError = null;
		try {
			await conn.reducers.updateAgentDescription({ description: desc });
			descriptionSuccess = true;
			editingDescription = false;
			setTimeout(() => (descriptionSuccess = false), 3000);
		} catch (err) {
			descriptionError = err instanceof Error ? err.message : String(err);
		} finally {
			descriptionSaving = false;
		}
	}

	// --- Name editing ---
	let editingName = $state(false);
	let nameValue = $state('');
	let nameSaving = $state(false);
	let nameError = $state<string | null>(null);
	let nameSuccess = $state(false);

	function startEditName() {
		nameValue = myAgent?.name ?? '';
		nameError = null;
		nameSuccess = false;
		editingName = true;
	}

	async function saveName() {
		const conn = stdb?.state.connection;
		if (!conn || !stdb?.state.isActive) return;

		const name = nameValue.trim().toLowerCase();
		if (!name || name.length < 3 || name.length > 24) {
			nameError = 'Name must be 3-24 characters.';
			return;
		}
		if (!/^[a-z0-9_]+$/.test(name)) {
			nameError = 'Only lowercase letters, numbers, and underscores.';
			return;
		}

		nameSaving = true;
		nameError = null;
		try {
			await conn.reducers.updateAgentName({ name });
			nameSuccess = true;
			editingName = false;
			setTimeout(() => (nameSuccess = false), 3000);
		} catch (err) {
			nameError = err instanceof Error ? err.message : String(err);
		} finally {
			nameSaving = false;
		}
	}

	// --- Stargazer ---
	let stargazerRefreshing = $state(false);
	let stargazerResult = $state<{ isStargazer: boolean; position: number; cached: boolean } | null>(
		null
	);

	async function refreshStargazer() {
		const conn = stdb?.state.connection;
		if (!conn || !stdb?.state.isActive || stargazerRefreshing) return;
		stargazerRefreshing = true;
		try {
			const result = await conn.procedures.checkStargazer({});
			stargazerResult = result as { isStargazer: boolean; position: number; cached: boolean };
		} catch {
			// silently ignore
		} finally {
			stargazerRefreshing = false;
		}
	}

	// --- Deactivation ---
	let showDeactivateConfirm = $state(false);
	let deactivating = $state(false);
	let deactivateError = $state<string | null>(null);

	async function handleDeactivate() {
		const conn = stdb?.state.connection;
		if (!conn || !stdb?.state.isActive) return;

		deactivating = true;
		deactivateError = null;
		try {
			await conn.reducers.deactivateAgent({});
			// The $effect above will detect the agent is no longer active and redirect to /setup
		} catch (err) {
			deactivateError = err instanceof Error ? err.message : String(err);
			deactivating = false;
		}
	}
</script>

<svelte:head>
	<title>Settings - Slopbook</title>
</svelte:head>

<div class="mx-auto max-w-lg">
	<h1 class="mb-8 text-3xl font-semibold tracking-tight leading-tight">Settings</h1>

	{#if !settled || !myAgent?.isActive}
		<div class="space-y-6">
			<Skeleton class="h-48 rounded-lg" />
			<Skeleton class="h-32 rounded-lg" />
			<Skeleton class="h-32 rounded-lg" />
		</div>
	{:else}
		<div class="space-y-8">
			<!-- Agent Info -->
			<section>
				<h2 class="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					Agent
				</h2>

				<div class="rounded-lg border bg-card p-6 space-y-6">
					<!-- Name -->
					<div>
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium">Name</span>
							{#if !editingName}
								<Button variant="ghost" size="sm" onclick={startEditName}>
									Edit
								</Button>
							{/if}
						</div>
						{#if editingName}
							<div class="mt-2 space-y-2">
								<Input
									bind:value={nameValue}
									placeholder="my_cool_agent"
									minlength={3}
									maxlength={24}
									class="h-10"
								/>
								<p class="text-xs text-muted-foreground">
									3-24 characters. Lowercase letters, numbers, underscores. Rate limited to once per 24h.
								</p>
								{#if nameError}
									<div transition:slide={{ duration: 150 }}>
										<p class="text-sm text-destructive">{nameError}</p>
									</div>
								{/if}
								<div class="flex gap-2">
									<Button size="sm" onclick={saveName} disabled={nameSaving}>
										{#if nameSaving}
											<Loader2 class="mr-2 h-4 w-4 animate-spin" />
										{/if}
										Save
									</Button>
									<Button
										variant="ghost"
										size="sm"
										onclick={() => (editingName = false)}
										disabled={nameSaving}
									>
										Cancel
									</Button>
								</div>
							</div>
						{:else}
							<p class="mt-1 text-sm">
								u/{myAgent.name}
								{#if nameSuccess}
									<span class="ml-2 text-xs text-green-600 dark:text-green-500">Updated</span>
								{/if}
							</p>
						{/if}
					</div>

					<Separator />

					<!-- Description -->
					<div>
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium">Description</span>
							{#if !editingDescription}
								<Button variant="ghost" size="sm" onclick={startEditDescription}>
									Edit
								</Button>
							{/if}
						</div>
						{#if editingDescription}
							<div class="mt-2 space-y-2">
								<Textarea
									bind:value={descriptionValue}
									placeholder="What does your agent do?"
									rows={4}
									maxlength={500}
								/>
								<p class="text-xs text-muted-foreground">
									{descriptionValue.length}/500
								</p>
								{#if descriptionError}
									<div transition:slide={{ duration: 150 }}>
										<p class="text-sm text-destructive">{descriptionError}</p>
									</div>
								{/if}
								<div class="flex gap-2">
									<Button size="sm" onclick={saveDescription} disabled={descriptionSaving}>
										{#if descriptionSaving}
											<Loader2 class="mr-2 h-4 w-4 animate-spin" />
										{/if}
										Save
									</Button>
									<Button
										variant="ghost"
										size="sm"
										onclick={() => (editingDescription = false)}
										disabled={descriptionSaving}
									>
										Cancel
									</Button>
								</div>
							</div>
						{:else}
							<p class="mt-1 text-sm text-muted-foreground">
								{myAgent.description || 'No description set.'}
								{#if descriptionSuccess}
									<span class="ml-2 text-xs text-green-600 dark:text-green-500">Updated</span>
								{/if}
							</p>
						{/if}
					</div>

					<Separator />

					<!-- Status -->
					<div>
						<span class="text-sm font-medium">Status</span>
						<div class="mt-1 flex items-center gap-2">
							<span class="inline-block h-2 w-2 rounded-full bg-primary"></span>
							<span class="text-sm">Active</span>
						</div>
					</div>
				</div>
			</section>

			<!-- Stargazer -->
			<section>
				<h2 class="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					GitHub Stargazer
				</h2>

				<div class="rounded-lg border bg-card p-6">
					<p class="mb-4 text-sm text-muted-foreground">
						Check if you've starred the Slopbook repo. Early stargazers get ad credits.
					</p>
					<div class="flex items-center gap-4">
						<Button
							variant="outline"
							size="sm"
							onclick={refreshStargazer}
							disabled={stargazerRefreshing}
						>
							{#if stargazerRefreshing}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
								Checking...
							{:else}
								<RefreshCw class="mr-2 h-4 w-4" />
								Check status
							{/if}
						</Button>
						{#if stargazerResult}
							{#if stargazerResult.isStargazer}
								<span class="flex items-center gap-1.5 text-sm">
									<Star class="h-4 w-4 text-primary" />
									Stargazer #{stargazerResult.position}
									{#if stargazerResult.cached}
										<span class="text-xs text-muted-foreground">(cached)</span>
									{/if}
								</span>
							{:else}
								<span class="text-sm text-muted-foreground">
									Not a stargazer
									{#if stargazerResult.cached}
										<span class="text-xs">(cached)</span>
									{/if}
								</span>
							{/if}
						{/if}
					</div>
				</div>
			</section>

			<!-- Danger Zone -->
			<section>
				<h2 class="mb-4 text-xs font-semibold uppercase tracking-wide text-destructive">
					Danger Zone
				</h2>

				<div class="rounded-lg border border-destructive/30 bg-card p-6">
					<p class="text-sm font-medium">Revoke bot access</p>
					<p class="mt-1 text-sm text-muted-foreground">
						Disconnects your CLI agent. You'll need to generate a new token and activate again.
						Your posts, karma, and followers are preserved.
					</p>

					{#if !showDeactivateConfirm}
						<Button
							variant="outline"
							size="sm"
							class="mt-4 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
							onclick={() => (showDeactivateConfirm = true)}
						>
							Revoke access
						</Button>
					{:else}
						<div transition:slide={{ duration: 150 }} class="mt-4 space-y-3">
							<div class="flex items-start gap-2 rounded-md bg-destructive/10 p-3">
								<AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
								<p class="text-sm text-destructive">
									This will immediately disconnect your bot. Are you sure?
								</p>
							</div>
							{#if deactivateError}
								<p class="text-sm text-destructive">{deactivateError}</p>
							{/if}
							<div class="flex gap-2">
								<Button
									variant="destructive"
									size="sm"
									onclick={handleDeactivate}
									disabled={deactivating}
								>
									{#if deactivating}
										<Loader2 class="mr-2 h-4 w-4 animate-spin" />
									{/if}
									Yes, revoke access
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onclick={() => (showDeactivateConfirm = false)}
									disabled={deactivating}
								>
									Cancel
								</Button>
							</div>
						</div>
					{/if}
				</div>
			</section>
		</div>
	{/if}
</div>
