/**
 * Reactive GitHub star count with localStorage caching.
 * Fetches from the GitHub API and caches for 5 minutes.
 */
import { onMount } from 'svelte';

const REPO = 'ImGajeed76/slopbook';
const CACHE_KEY = 'slopbook_star_count';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedStarCount {
	count: number;
	fetchedAt: number;
}

export interface StarCountState {
	readonly count: number | undefined;
	readonly loading: boolean;
	readonly target: number | undefined;
	readonly tier: 'pre-1k' | 'pre-5k' | 'post-5k';
}

function getCached(): CachedStarCount | null {
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (
			typeof parsed === 'object' &&
			parsed !== null &&
			'count' in parsed &&
			'fetchedAt' in parsed &&
			typeof (parsed as CachedStarCount).count === 'number' &&
			typeof (parsed as CachedStarCount).fetchedAt === 'number'
		) {
			const cached = parsed as CachedStarCount;
			if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
				return cached;
			}
		}
	} catch {
		// Ignore parse errors
	}
	return null;
}

function setCache(count: number): void {
	localStorage.setItem(CACHE_KEY, JSON.stringify({ count, fetchedAt: Date.now() }));
}

function getTier(count: number): 'pre-1k' | 'pre-5k' | 'post-5k' {
	if (count < 1000) return 'pre-1k';
	if (count < 5000) return 'pre-5k';
	return 'post-5k';
}

function getTarget(count: number): number | undefined {
	if (count < 1000) return 1000;
	if (count < 5000) return 5000;
	return undefined;
}

/**
 * Creates a reactive star count state. Call during component init.
 * Fetches the GitHub star count on mount, uses localStorage cache.
 */
export function useStarCount(): StarCountState {
	let count = $state<number | undefined>(undefined);
	let loading = $state(true);

	onMount(async () => {
		const cached = getCached();
		if (cached) {
			count = cached.count;
			loading = false;
			return;
		}

		try {
			const response = await fetch(`https://api.github.com/repos/${REPO}`, {
				headers: { Accept: 'application/vnd.github+json' },
			});
			if (response.ok) {
				const data = await response.json();
				if (typeof data.stargazers_count === 'number') {
					count = data.stargazers_count;
					setCache(data.stargazers_count);
				}
			}
		} catch {
			// Silently fail — star count is non-critical
		} finally {
			loading = false;
		}
	});

	return {
		get count() { return count; },
		get loading() { return loading; },
		get target() { return count !== undefined ? getTarget(count) : undefined; },
		get tier() { return count !== undefined ? getTier(count) : 'pre-1k'; },
	};
}

export const GITHUB_REPO_URL = `https://github.com/${REPO}`;
