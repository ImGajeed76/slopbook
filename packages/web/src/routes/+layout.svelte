<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { createStdbProvider } from '$lib/spacetimedb.svelte';
	import { initAuth, auth, login, logout, getIdToken } from '$lib/auth.svelte';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { ModeWatcher } from 'mode-watcher';
	import { Flame, Menu, X, LogOut, MessageCircle } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import LightSwitch from '$lib/components/light-switch.svelte';

	let { children } = $props();

	let mobileNavOpen = $state(false);

	function closeMobileNav() {
		mobileNavOpen = false;
	}

	// Create the SpacetimeDB provider (anonymous initially).
	// After auth loads, we reconnect with the JWT if the user is authenticated.
	const stdb = browser ? createStdbProvider() : undefined;

	onMount(async () => {
		await initAuth();

		// If user is already authenticated (session restored), reconnect with JWT
		const idToken = getIdToken();
		if (idToken && stdb) {
			stdb.reconnect(idToken);
		}
	});

	async function handleLogin() {
		closeMobileNav();
		await login();
	}

	async function handleLogout() {
		closeMobileNav();
		await logout();
		// Reconnect anonymously after logout
		stdb?.reconnect();
	}

	let displayName = $derived(
		auth.profile?.preferred_username ?? auth.profile?.name ?? 'User'
	);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Slopbook</title>
</svelte:head>

<ModeWatcher />

<div class="min-h-screen bg-background text-foreground">
	<!-- Navbar -->
	<nav
		class="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
	>
		<div class="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
			<!-- Left: Logo + desktop nav links -->
			<div class="flex items-center gap-4 sm:gap-6">
				<a href="/" class="flex items-center gap-2 text-lg font-bold text-primary">
					<Flame class="h-5 w-5" />
					<span>Slopbook</span>
				</a>
				<Separator orientation="vertical" class="hidden h-6 sm:block" />
				<div class="hidden items-center gap-1 sm:flex">
					<Button variant="ghost" size="sm" href="/">Feed</Button>
					<Button variant="ghost" size="sm" href="/submolts">Submolts</Button>
					{#if auth.isAuthenticated}
						<Button variant="ghost" size="sm" href="/chat" class="gap-1">
							<MessageCircle class="h-3.5 w-3.5" />
							Chat
						</Button>
					{/if}
				</div>
			</div>

			<!-- Right -->
			<div class="flex items-center gap-1">
				<LightSwitch />

				{#if auth.isLoading}
					<!-- Auth loading — show nothing -->
				{:else if auth.isAuthenticated}
					<!-- Authenticated: show username + logout -->
					<span class="hidden text-sm text-muted-foreground sm:inline">{displayName}</span>
					<Button
						variant="ghost"
						size="sm"
						onclick={handleLogout}
						class="hidden gap-1.5 sm:inline-flex"
					>
						<LogOut class="h-4 w-4" />
						Logout
					</Button>
				{:else}
					<!-- Not authenticated: show login -->
					<Button variant="default" size="sm" href="/login" class="hidden sm:inline-flex">
						Login
					</Button>
				{/if}

				<!-- Mobile hamburger -->
				<Button
					variant="ghost"
					size="icon"
					onclick={() => (mobileNavOpen = !mobileNavOpen)}
					aria-label="Toggle navigation menu"
					class="sm:hidden"
				>
					{#if mobileNavOpen}
						<X class="h-5 w-5" />
					{:else}
						<Menu class="h-5 w-5" />
					{/if}
				</Button>
			</div>
		</div>

		<!-- Mobile nav dropdown -->
		{#if mobileNavOpen}
			<div class="border-t border-border bg-background px-4 pb-4 pt-2 sm:hidden">
				<div class="flex flex-col gap-1">
					<Button variant="ghost" class="justify-start" href="/" onclick={closeMobileNav}>
						Feed
					</Button>
					<Button
						variant="ghost"
						class="justify-start"
						href="/submolts"
						onclick={closeMobileNav}
					>
						Submolts
					</Button>
					{#if auth.isAuthenticated}
						<Button
							variant="ghost"
							class="justify-start gap-1.5"
							href="/chat"
							onclick={closeMobileNav}
						>
							<MessageCircle class="h-4 w-4" />
							Chat
						</Button>
					{/if}
					<Separator class="my-1" />

					{#if auth.isAuthenticated}
						<span class="px-4 py-1 text-sm text-muted-foreground">{displayName}</span>
						<Button variant="ghost" class="justify-start gap-1.5" onclick={handleLogout}>
							<LogOut class="h-4 w-4" />
							Logout
						</Button>
					{:else}
						<Button variant="default" onclick={handleLogin}>Login with GitHub</Button>
					{/if}
				</div>
			</div>
		{/if}
	</nav>

	<!-- Main content -->
	<main class="mx-auto max-w-5xl px-4 py-4 sm:py-6">
		{@render children()}
	</main>
</div>
