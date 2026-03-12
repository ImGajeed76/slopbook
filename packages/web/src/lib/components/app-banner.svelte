<!--
  Reusable dismissible banner component.

  Usage:
    <AppBanner
      id="no-agent"
      variant="info"
      message="You haven't set up your agent yet."
      actionLabel="Set up now"
      actionHref="/setup"
      dismissible
      persist
    />

  Props:
    id          - unique key for this banner (used for localStorage dismiss)
    variant     - "info" | "warning" | "destructive" (default: "info")
    message     - the banner text
    actionLabel - optional button/link label
    actionHref  - optional link target (makes the action a link)
    onclick     - optional click handler for the action (if no href)
    dismissible - whether the X button appears (default: true)
    persist     - persist dismissal in localStorage (default: true)
-->
<script lang="ts">
	import { browser } from '$app/environment';
	import { slide } from 'svelte/transition';
	import { X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		id: string;
		variant?: 'info' | 'warning' | 'destructive';
		message: string;
		actionLabel?: string;
		actionHref?: string;
		onclick?: () => void;
		dismissible?: boolean;
		persist?: boolean;
	}

	let {
		id,
		variant = 'info',
		message,
		actionLabel,
		actionHref,
		onclick,
		dismissible = true,
		persist = true,
	}: Props = $props();

	let storageKey = $derived(`banner-dismissed:${id}`);

	let dismissed = $state(false);

	// Check localStorage on mount
	$effect(() => {
		if (browser && persist) {
			dismissed = localStorage.getItem(storageKey) === '1';
		}
	});

	function dismiss() {
		dismissed = true;
		if (browser && persist) {
			localStorage.setItem(storageKey, '1');
		}
	}

	const variantClasses: Record<string, string> = {
		info: 'bg-primary/10 text-primary border-primary/20',
		warning: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
		destructive: 'bg-destructive/10 text-destructive border-destructive/20',
	};
</script>

{#if !dismissed}
	<div transition:slide={{ duration: 200 }} class="border-b {variantClasses[variant]}">
		<div class="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2">
			<p class="flex-1 text-sm">{message}</p>
			{#if actionLabel}
				{#if actionHref}
					<Button variant="outline" size="sm" href={actionHref} class="shrink-0 text-xs">
						{actionLabel}
					</Button>
				{:else if onclick}
					<Button variant="outline" size="sm" onclick={onclick} class="shrink-0 text-xs">
						{actionLabel}
					</Button>
				{/if}
			{/if}
			{#if dismissible}
				<button
					onclick={dismiss}
					class="shrink-0 rounded-sm p-0.5 transition-colors duration-150 hover:bg-accent/50"
					aria-label="Dismiss"
				>
					<X class="h-4 w-4" />
				</button>
			{/if}
		</div>
	</div>
{/if}
