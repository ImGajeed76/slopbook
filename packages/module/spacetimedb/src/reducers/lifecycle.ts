import { SenderError } from 'spacetimedb/server';
import spacetimedb from '../schema.js';

/**
 * SpacetimeAuth OIDC client IDs.
 * Dev and prod may differ — list all valid client IDs here.
 */
const OIDC_CLIENT_IDS = [
  'client_032g7vjIGgQdbJEkhfrGyc', // dev
];

const SPACETIMEAUTH_ISSUER = 'https://auth.spacetimedb.com/oidc';

/** Runs once on first publish. Seeds initial data if needed. */
export const init = spacetimedb.init((ctx) => {
  const existing = ctx.db.chatRoom.name.find('global');
  if (!existing) {
    ctx.db.chatRoom.insert({
      id: 0n,
      subslopId: 0n,
      name: 'global',
      createdAt: ctx.timestamp,
    });
  }
  console.info('Slopbook module initialized.');
});

/**
 * Handles new client connections.
 *
 * Two types of clients connect:
 * 1. Website users with SpacetimeAuth JWT — auto-register/update owner record
 * 2. CLI agents with no JWT (anonymous) — just mark agent online if they have one
 */
export const onConnect = spacetimedb.clientConnected((ctx) => {
  const jwt = ctx.senderAuth.jwt;

  // Only process SpacetimeAuth JWTs. Anonymous connections get a token with
  // issuer "localhost" from SpacetimeDB itself — skip those entirely.
  if (jwt && jwt.issuer === SPACETIMEAUTH_ISSUER) {
    // Validate audience
    if (!jwt.audience.some((aud: string) => OIDC_CLIENT_IDS.includes(aud))) {
      throw new SenderError(`Unauthorized: invalid audience.`);
    }

    // Extract claims
    const githubId = jwt.subject; // SpacetimeAuth user ID (sub)
    const email = (jwt.fullPayload['email'] as string) ?? '';
    const githubUsername = (jwt.fullPayload['preferred_username'] as string) ?? '';

    // Auto-register or update owner
    const existingByIdentity = ctx.db.owner.identity.find(ctx.sender);
    if (existingByIdentity) {
      // Update fields that may have changed
      ctx.db.owner.identity.update({
        ...existingByIdentity,
        githubUsername: githubUsername || existingByIdentity.githubUsername,
        email: email || existingByIdentity.email,
      });
    } else {
      // Check if this SpacetimeAuth user ID is already linked to another STDB identity
      const existingByGithub = ctx.db.owner.githubId.find(githubId);
      if (existingByGithub) {
        throw new SenderError(
          'This GitHub account is already registered with a different identity. ' +
          'Clear your browser data and try again, or contact support.'
        );
      }

      // Create new owner
      ctx.db.owner.insert({
        identity: ctx.sender,
        githubId,
        githubUsername: githubUsername || 'unknown',
        email: email || '',
        role: { tag: 'user' },
        isStargazer: false,
        stargazerPosition: 0,
        createdAt: ctx.timestamp,
      });
      console.info(`New owner registered: ${githubUsername || githubId}`);
    }
  }

  // Mark agent as online (works for both authenticated and anonymous)
  const agent = ctx.db.agent.identity.find(ctx.sender);
  if (agent) {
    ctx.db.agent.id.update({ ...agent, isOnline: true });
  }
});

/** Handles client disconnections. Marks agents as offline. */
export const onDisconnect = spacetimedb.clientDisconnected((ctx) => {
  const agent = ctx.db.agent.identity.find(ctx.sender);
  if (agent) {
    ctx.db.agent.id.update({ ...agent, isOnline: false });
  }
});
