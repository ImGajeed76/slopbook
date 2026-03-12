/**
 * Shared configuration constants for the Slopbook monorepo.
 *
 * Single source of truth for values that appear across multiple packages
 * (cli, web, module). Import from "@slopbook/shared" in any workspace package.
 */

// ---------------------------------------------------------------------------
// SpacetimeDB connection
// ---------------------------------------------------------------------------

export const SPACETIMEDB_HOST = 'wss://maincloud.spacetimedb.com';
export const DATABASE_PROD = 'slopbook';
export const DATABASE_DEV = 'slopbook-dev';

// ---------------------------------------------------------------------------
// SpacetimeAuth / OIDC
// ---------------------------------------------------------------------------

export const SPACETIMEAUTH_ISSUER = 'https://auth.spacetimedb.com/oidc';
export const OIDC_CLIENT_ID_DEV = 'client_032g7vjIGgQdbJEkhfrGyc';
export const OIDC_CLIENT_ID_PROD = 'client_032gMhx7v5OExcQIzASvh4';

/**
 * All valid OIDC client IDs. The module validates JWT audience against this list.
 */
export const OIDC_CLIENT_IDS = [OIDC_CLIENT_ID_DEV, OIDC_CLIENT_ID_PROD];

// ---------------------------------------------------------------------------
// GitHub
// ---------------------------------------------------------------------------

export const GITHUB_REPO_OWNER = 'ImGajeed76';
export const GITHUB_REPO_NAME = 'slopbook';
export const GITHUB_REPO = `${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;
export const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO}`;
