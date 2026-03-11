/**
 * SpacetimeDB table subscription helpers for Svelte 5 runes.
 *
 * Works with our custom StdbProvider (not the SDK's createSpacetimeDBProvider).
 * Subscribes to a table via the connection, handles reconnection automatically,
 * and exposes reactive rows/ready state via runes.
 */
import { browser } from '$app/environment';
import { useStdb } from '$lib/spacetimedb.svelte';
import { SubscriptionBuilder } from '$lib/module_bindings';
import type { DbConnection } from '$lib/module_bindings';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TableState<T> {
	readonly rows: readonly T[];
	readonly ready: boolean;
}

/**
 * Minimal interface for a table accessor on `connection.db.*`.
 * Matches the SpacetimeDB SDK's generated table cache shape.
 */
interface TableAccessor<T> {
	iter(): Iterable<T>;
	onInsert(
		cb: (ctx: unknown, row: T) => void
	): void;
	onDelete(
		cb: (ctx: unknown, row: T) => void
	): void;
	onUpdate?(
		cb: (ctx: unknown, oldRow: T, newRow: T) => void
	): void;
	removeOnInsert(
		cb: (ctx: unknown, row: T) => void
	): void;
	removeOnDelete(
		cb: (ctx: unknown, row: T) => void
	): void;
	removeOnUpdate?(
		cb: (ctx: unknown, oldRow: T, newRow: T) => void
	): void;
}

/**
 * A function that takes a `DbConnection` and returns the table accessor.
 * This avoids issues with the table reference becoming stale after reconnect.
 *
 * Example: `(conn) => conn.db.post`
 */
type TableSelector<T> = (conn: DbConnection) => TableAccessor<T>;

// ---------------------------------------------------------------------------
// useTableState
// ---------------------------------------------------------------------------

/**
 * Subscribe to a SpacetimeDB table, returning a rune-compatible reactive state.
 * Safe to call during SSR (returns empty arrays / false).
 *
 * Automatically re-subscribes when the connection changes (e.g. after reconnect).
 *
 * Usage:
 *   const posts = useTableState<Post>((conn) => conn.db.post, 'SELECT * FROM post');
 *   // posts.rows — reactive readonly array of Post rows
 *   // posts.ready — reactive boolean
 *
 * @param selector - Function that extracts the table accessor from a connection.
 * @param query - SQL subscription query string.
 */
export function useTableState<T>(
	selector: TableSelector<T>,
	query: string
): TableState<T> {
	let rows: readonly T[] = $state([]);
	let ready: boolean = $state(false);

	if (!browser) {
		return {
			get rows() {
				return rows;
			},
			get ready() {
				return ready;
			},
		};
	}

	const stdb = useStdb();

	let cleanupFn: (() => void) | null = null;

	function setupSubscription(conn: DbConnection) {
		const table = selector(conn);

		// Read initial rows
		rows = Array.from(table.iter()) as T[];

		// Listen for live changes
		const onInsertCb = (_ctx: unknown, _row: T) => {
			rows = Array.from(table.iter()) as T[];
		};
		const onDeleteCb = (_ctx: unknown, _row: T) => {
			rows = Array.from(table.iter()) as T[];
		};
		const onUpdateCb = (_ctx: unknown, _oldRow: T, _newRow: T) => {
			rows = Array.from(table.iter()) as T[];
		};

		table.onInsert(onInsertCb);
		table.onDelete(onDeleteCb);
		table.onUpdate?.(onUpdateCb);

		// Subscribe to the query
		let subHandle: { unsubscribe(): void } | null = null;

		subHandle = conn
			.subscriptionBuilder()
			.onApplied(() => {
				ready = true;
				rows = Array.from(table.iter()) as T[];
			})
			.subscribe(query);

		return () => {
			table.removeOnInsert(onInsertCb);
			table.removeOnDelete(onDeleteCb);
			table.removeOnUpdate?.(onUpdateCb);
			subHandle?.unsubscribe();
		};
	}

	$effect(() => {
		// Reactive dependency on stdb.state.isActive and stdb.state.connection
		const { isActive, connection } = stdb.state;

		// Clean up previous subscription
		if (cleanupFn) {
			cleanupFn();
			cleanupFn = null;
		}

		if (isActive && connection) {
			cleanupFn = setupSubscription(connection);
		} else {
			rows = [];
			ready = false;
		}

		return () => {
			if (cleanupFn) {
				cleanupFn();
				cleanupFn = null;
			}
		};
	});

	return {
		get rows() {
			return rows;
		},
		get ready() {
			return ready;
		},
	};
}
