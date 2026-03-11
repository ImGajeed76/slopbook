/**
 * Authentication state management for Slopbook.
 *
 * Uses oidc-client-ts for the SpacetimeAuth OIDC flow.
 * The ID token (JWT) is passed to SpacetimeDB via withToken() on connection.
 */
import { UserManager, type User, type UserManagerSettings } from 'oidc-client-ts';
import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

const SPACETIMEAUTH_AUTHORITY = 'https://auth.spacetimedb.com/oidc';

function getClientId(): string {
	return env.PUBLIC_OIDC_CLIENT_ID ?? 'client_032g7vjIGgQdbJEkhfrGyc';
}

function getRedirectUri(): string {
	if (!browser) return '';
	return `${window.location.origin}/auth/callback`;
}

function getPostLogoutRedirectUri(): string {
	if (!browser) return '';
	return window.location.origin;
}

let userManager: UserManager | undefined;

function getUserManager(): UserManager {
	if (!userManager) {
		const settings: UserManagerSettings = {
			authority: SPACETIMEAUTH_AUTHORITY,
			client_id: getClientId(),
			redirect_uri: getRedirectUri(),
			post_logout_redirect_uri: getPostLogoutRedirectUri(),
			scope: 'openid profile email',
			response_type: 'code',
			automaticSilentRenew: true,
		};
		userManager = new UserManager(settings);
	}
	return userManager;
}

// Reactive auth state using Svelte 5 runes
let currentUser: User | null = $state(null);
let isLoading: boolean = $state(true);
let authError: string | null = $state(null);

/**
 * Initialize auth — loads user from storage if available.
 * Call once from the root layout.
 */
export async function initAuth(): Promise<void> {
	if (!browser) return;
	try {
		const um = getUserManager();
		const user = await um.getUser();
		if (user && !user.expired) {
			currentUser = user;
		} else {
			currentUser = null;
		}
	} catch (err) {
		console.error('Failed to load auth state:', err);
		authError = err instanceof Error ? err.message : String(err);
	} finally {
		isLoading = false;
	}
}

/** Redirect to SpacetimeAuth login page. */
export async function login(): Promise<void> {
	if (!browser) return;
	try {
		authError = null;
		await getUserManager().signinRedirect();
	} catch (err) {
		authError = err instanceof Error ? err.message : String(err);
	}
}

/** Handle the OIDC callback after redirect back from SpacetimeAuth. */
export async function handleCallback(): Promise<User | null> {
	if (!browser) return null;
	try {
		authError = null;
		isLoading = true;
		const user = await getUserManager().signinRedirectCallback();
		currentUser = user;
		return user;
	} catch (err) {
		authError = err instanceof Error ? err.message : String(err);
		currentUser = null;
		return null;
	} finally {
		isLoading = false;
	}
}

/** Sign out and clear state. */
export async function logout(): Promise<void> {
	if (!browser) return;
	try {
		await getUserManager().signoutRedirect();
	} catch (err) {
		// If signout redirect fails, clear locally
		await getUserManager().removeUser();
		currentUser = null;
	}
}

/** Get the current OIDC ID token (JWT string) for passing to SpacetimeDB. */
export function getIdToken(): string | undefined {
	return currentUser?.id_token ?? undefined;
}

/** Reactive getters for use in Svelte components. */
export const auth = {
	get user() {
		return currentUser;
	},
	get isAuthenticated() {
		return currentUser !== null && !currentUser.expired;
	},
	get isLoading() {
		return isLoading;
	},
	get error() {
		return authError;
	},
	get profile() {
		return currentUser?.profile ?? null;
	},
};
