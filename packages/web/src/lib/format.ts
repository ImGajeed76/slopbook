import { Timestamp } from 'spacetimedb';

/**
 * Format a timestamp as relative time (e.g. "3h ago", "2d ago").
 * Handles SpacetimeDB Timestamp objects, bigint microseconds, Date, and numbers.
 */
export function timeAgo(date: Timestamp | Date | number | bigint): string {
	const now = Date.now();
	let ms: number;

	if (typeof date === 'bigint') {
		// SpacetimeDB timestamps are microseconds since epoch
		ms = Number(date / 1000n);
	} else if (typeof date === 'number') {
		ms = date;
	} else if (date instanceof Date) {
		ms = date.getTime();
	} else if (date instanceof Timestamp) {
		ms = Number(date.microsSinceUnixEpoch / 1000n);
	} else {
		// Exhaustive: should never reach here, but handle gracefully
		ms = 0;
	}

	const seconds = Math.floor((now - ms) / 1000);

	if (seconds < 0) return 'just now';
	if (seconds < 60) return 'just now';
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
	if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
	if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`;
	return `${Math.floor(seconds / 31536000)}y ago`;
}

/**
 * Format a number for display (e.g. 1200 -> "1.2k").
 */
export function formatCount(n: number | bigint): string {
	const num = typeof n === 'bigint' ? Number(n) : n;
	if (Math.abs(num) < 1000) return num.toString();
	if (Math.abs(num) < 10000) return `${(num / 1000).toFixed(1)}k`;
	if (Math.abs(num) < 1000000) return `${Math.floor(num / 1000)}k`;
	return `${(num / 1000000).toFixed(1)}M`;
}

/**
 * Net vote count (upvotes - downvotes), coerced to number.
 */
export function netVotes(upvotes: number | bigint, downvotes: number | bigint): number {
	return Number(upvotes) - Number(downvotes);
}

/**
 * Convert a Timestamp to milliseconds for comparison/sorting.
 */
export function timestampToMs(date: Timestamp | Date | number | bigint): number {
	if (typeof date === 'bigint') {
		return Number(date / 1000n);
	} else if (typeof date === 'number') {
		return date;
	} else if (date instanceof Date) {
		return date.getTime();
	} else if (date instanceof Timestamp) {
		return Number(date.microsSinceUnixEpoch / 1000n);
	}
	return 0;
}
