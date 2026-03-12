/**
 * Custom SpacetimeDB provider with reconnection support.
 *
 * Replaces the SDK's `createSpacetimeDBProvider` to support tearing down
 * an anonymous connection and rebuilding it with a JWT when the user
 * authenticates. All downstream consumers (useTableState, components)
 * react to the connection change automatically via Svelte 5 runes.
 */
import { setContext, getContext, onDestroy } from 'svelte';
import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import { DbConnection } from '$lib/module_bindings';
import { type Identity, setGlobalLogLevel } from 'spacetimedb';
import { SPACETIMEDB_HOST, DATABASE_PROD, DATABASE_DEV } from '@slopbook/shared';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CONTEXT_KEY = Symbol('slopbook-stdb');

export function getDatabaseName(): string {
	const fromEnv = env.PUBLIC_SLOPBOOK_DB;
	if (fromEnv) return fromEnv;

	if (typeof window !== 'undefined') {
		const params = new URLSearchParams(window.location.search);
		const envParam = params.get('env');
		if (envParam === 'prod') return DATABASE_PROD;
	}

	return DATABASE_DEV;
}

// ---------------------------------------------------------------------------
// Connection state (reactive via Svelte 5 runes)
// ---------------------------------------------------------------------------

export interface StdbState {
	readonly connection: DbConnection | null;
	readonly isActive: boolean;
	readonly identity: Identity | undefined;
	readonly token: string | undefined;
	readonly error: Error | undefined;
	/** True after the first reconnect() call has completed (JWT connection is up). */
	readonly hasReconnected: boolean;
}

/**
 * The provider instance stored in Svelte context.
 * Exposes reactive state and a `reconnect` method.
 */
export interface StdbProvider {
	/** Reactive connection state. */
	readonly state: StdbState;
	/**
	 * Tear down the current connection and build a new one.
	 * If `idToken` is provided the new connection is authenticated.
	 * If omitted the new connection is anonymous.
	 */
	reconnect(idToken?: string): void;
	/** Disconnect and clean up. */
	destroy(): void;
}

// ---------------------------------------------------------------------------
// Provider factory (call in root +layout.svelte)
// ---------------------------------------------------------------------------

/**
 * Create the SpacetimeDB provider and store it in Svelte component context.
 * Must be called in a component's synchronous init (not in onMount).
 *
 * @param idToken - optional JWT for an authenticated initial connection
 */
export function createStdbProvider(idToken?: string): StdbProvider {
	// Reactive state
	let connection: DbConnection | null = $state(null);
	let isActive: boolean = $state(false);
	let identity: Identity | undefined = $state(undefined);
	let token: string | undefined = $state(undefined);
	let error: Error | undefined = $state(undefined);
	let hasReconnected: boolean = $state(false);

	/** Guard to prevent reacting to our own disconnect() calls */
	let intentionalDisconnect = false;

	function connect(idTok?: string) {
		if (!browser) return;

		const dbName = getDatabaseName();

		const builder = DbConnection.builder()
			.withUri(SPACETIMEDB_HOST)
			.withDatabaseName(dbName);

		if (idTok) {
			builder.withToken(idTok);
		}

		builder.onConnect((conn: DbConnection, id: Identity, tok: string) => {
			connection = conn;
			isActive = true;
			identity = id;
			token = tok;
			error = undefined;
		});

		builder.onDisconnect(() => {
			if (!intentionalDisconnect) {
				isActive = false;
			}
		});

		builder.onConnectError((_ctx: unknown, err: Error) => {
			console.error('[stdb] Connection error:', err);
			error = err;
			isActive = false;
		});

		// build() returns the connection synchronously but connects asynchronously.
		// Don't set isActive here — wait for onConnect callback.
		const conn = builder.build();
		connection = conn;
	}

	function disconnect() {
		if (connection) {
			intentionalDisconnect = true;
			connection.disconnect();
			connection = null;
			isActive = false;
			identity = undefined;
			token = undefined;
			intentionalDisconnect = false;
		}
	}

	function reconnect(idTok?: string) {
		disconnect();
		connect(idTok);
		hasReconnected = true;
	}

	function destroy() {
		disconnect();
	}

	// Suppress SDK info/debug/trace logs — only show warnings and errors
	setGlobalLogLevel('warn');

	// Initial connection
	connect(idToken);

	const provider: StdbProvider = {
		get state(): StdbState {
			return {
				connection,
				isActive,
				identity,
				token,
				error,
				hasReconnected,
			};
		},
		reconnect,
		destroy,
	};

	setContext(CONTEXT_KEY, provider);

	onDestroy(() => {
		destroy();
	});

	return provider;
}

// ---------------------------------------------------------------------------
// Consumer hook (call in any child component)
// ---------------------------------------------------------------------------

/**
 * Get the StdbProvider from Svelte context.
 * Must be called during component initialization.
 */
export function useStdb(): StdbProvider {
	const provider = getContext<StdbProvider | undefined>(CONTEXT_KEY);
	if (!provider) {
		throw new Error(
			'useStdb() must be used within a component tree that called createStdbProvider(). ' +
				'Did you forget to call createStdbProvider() in +layout.svelte?'
		);
	}
	return provider;
}

export { SPACETIMEDB_HOST };
