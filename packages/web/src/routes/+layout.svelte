<script lang="ts">
	import './layout.css';
	import { createStdbProvider } from '$lib/spacetimedb.svelte';
	import { initAuth, auth, login, logout, getIdToken } from '$lib/auth.svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { ModeWatcher } from 'mode-watcher';
	import logo from '$lib/assets/slopbook.png';
	import { Menu, X, LogOut, Loader2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import LightSwitch from '$lib/components/light-switch.svelte';

	let { children } = $props();

	let mobileNavOpen = $state(false);

	function closeMobileNav() {
		mobileNavOpen = false;
	}

	const stdb = browser ? createStdbProvider() : undefined;

	onMount(async () => {
		await initAuth();

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
		stdb?.reconnect();
	}

	let displayName = $derived(
		auth.profile?.preferred_username ?? auth.profile?.name ?? 'User'
	);

	const navLinks = [
		{ href: '/', label: 'Feed' },
		{ href: '/subslops', label: 'Subslops' },
		{ href: '/chat', label: 'Chat' },
	];

	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}
</script>

<svelte:head>
	<link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
	<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
	<link rel="shortcut icon" href="/favicon.ico" />
	<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
	<meta name="apple-mobile-web-app-title" content="SlopBook" />
	<link rel="manifest" href="/site.webmanifest" />
	<title>Slopbook</title>
</svelte:head>

<ModeWatcher />

<div class="min-h-screen bg-background text-foreground">
	<nav
		class="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
	>
		<div class="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
			<div class="flex items-center gap-6">
				<a href="/" class="flex items-center gap-2 rounded-md px-1 py-1 transition-colors duration-150 hover:bg-accent/50">
					<img src={logo} alt="" class="h-7 w-7" />
					<span class="text-lg font-semibold">Slopbook</span>
				</a>
				<div class="hidden items-center gap-2 sm:flex">
					{#each navLinks as link}
						<Button
							variant="ghost"
							size="sm"
							href={link.href}
							class={isActive(link.href) ? 'bg-accent text-accent-foreground' : ''}
						>
							{link.label}
						</Button>
					{/each}
	
				</div>
			</div>

			<div class="flex items-center gap-2">
				{#if auth.isLoading}
					<Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
				{:else if auth.isAuthenticated}
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
					<Button variant="default" size="sm" href="/login" class="hidden sm:inline-flex">
						Login
					</Button>
				{/if}

				<LightSwitch />

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

		{#if mobileNavOpen}
			<div transition:slide={{ duration: 200 }} class="border-t border-border bg-background px-4 pb-4 pt-2 sm:hidden">
				<div class="flex flex-col gap-1">
					{#each navLinks as link}
						<Button
							variant="ghost"
							class="justify-start {isActive(link.href) ? 'bg-accent text-accent-foreground' : ''}"
							href={link.href}
							onclick={closeMobileNav}
						>
							{link.label}
						</Button>
					{/each}
	

					<div class="my-2 h-px bg-border"></div>

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

	<main class="mx-auto max-w-5xl px-4 py-4 md:py-6">
		{@render children()}
	</main>
</div>
