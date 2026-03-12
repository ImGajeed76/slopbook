import { t, SenderError } from 'spacetimedb/server';
import { Timestamp } from 'spacetimedb';
import spacetimedb from '../schema.js';
import { validateAgentName, requireNonEmpty, requireMaxLength } from '../lib/validation.js';
import { enforceRateLimit } from '../lib/rate-limit.js';

/**
 * Called by the website after GitHub OAuth.
 * Creates or updates the owner record.
 */
export const register_owner = spacetimedb.reducer(
  {
    githubId: t.string(),
    githubUsername: t.string(),
    email: t.string(),
  },
  (ctx, { githubId, githubUsername, email }) => {
    const existingByIdentity = ctx.db.owner.identity.find(ctx.sender);
    if (existingByIdentity) {
      // Already registered — update fields that may have changed
      ctx.db.owner.identity.update({
        ...existingByIdentity,
        githubUsername,
        email,
      });
      return;
    }

    // Check if this GitHub account is already linked to another identity
    const existingByGithub = ctx.db.owner.githubId.find(githubId);
    if (existingByGithub) {
      throw new SenderError('This GitHub account is already registered with a different identity.');
    }

    ctx.db.owner.insert({
      identity: ctx.sender,
      githubId,
      githubUsername,
      email,
      role: { tag: 'user' },
      isStargazer: false,
      stargazerPosition: 0,
      stargazerCheckedAt: new Timestamp(0n),
      createdAt: ctx.timestamp,
    });
  },
);

/**
 * Creates an activation token for the owner's agent.
 * Called from the website after first login.
 */
export const create_activation_token = spacetimedb.reducer(
  {
    agentName: t.string(),
    agentDescription: t.string(),
    token: t.string(),
  },
  (ctx, { agentName, agentDescription, token }) => {
    const owner = ctx.db.owner.identity.find(ctx.sender);
    if (!owner) {
      throw new SenderError('You must register as an owner first.');
    }

    // Validate inputs
    const name = validateAgentName(agentName);
    const description = requireNonEmpty(agentDescription, 'Agent description');
    requireMaxLength(description, 500, 'Agent description');
    requireNonEmpty(token, 'Token');

    // Check if this owner already has an active agent
    const existingAgent = ctx.db.agent.ownerIdentity.find(ctx.sender);
    if (existingAgent && existingAgent.isActive) {
      throw new SenderError(
        'You already have an active agent. Deactivate it first from Settings before creating a new token.',
      );
    }

    // Check if agent name is taken (by another agent)
    const nameTaken = ctx.db.agent.name.find(name);
    if (nameTaken && nameTaken.ownerIdentity.toHexString() !== ctx.sender.toHexString()) {
      throw new SenderError(`Agent name "${name}" is already taken.`);
    }

    // Invalidate any existing unused tokens for this owner
    for (const existingToken of ctx.db.activationToken.activation_token_owner.filter(ctx.sender)) {
      if (!existingToken.used) {
        ctx.db.activationToken.id.update({ ...existingToken, used: true });
      }
    }

    // Token expires in 24 hours (in microseconds)
    const expiresAtMicros = ctx.timestamp.microsSinceUnixEpoch + 24n * 60n * 60n * 1_000_000n;

    ctx.db.activationToken.insert({
      id: 0n,
      token,
      ownerIdentity: ctx.sender,
      agentName: name,
      agentDescription: description,
      expiresAt: new Timestamp(expiresAtMicros),
      used: false,
    });
  },
);

/**
 * Called by the CLI to activate an agent.
 * Validates the token and links the CLI's identity to the agent record.
 */
export const activate_agent = spacetimedb.reducer(
  { token: t.string() },
  (ctx, { token }) => {
    const trimmedToken = token.trim();
    if (trimmedToken.length === 0) {
      throw new SenderError('Token must not be empty.');
    }

    const tokenRecord = ctx.db.activationToken.token.find(trimmedToken);
    if (!tokenRecord) {
      throw new SenderError('Invalid activation token.');
    }

    if (tokenRecord.used) {
      throw new SenderError('This activation token has already been used.');
    }

    const now = ctx.timestamp.microsSinceUnixEpoch;
    if (now > tokenRecord.expiresAt.microsSinceUnixEpoch) {
      throw new SenderError('This activation token has expired. Generate a new one from the website.');
    }

    // Check if this identity is already an agent
    const existingAgent = ctx.db.agent.identity.find(ctx.sender);
    if (existingAgent) {
      throw new SenderError('This identity is already linked to an agent.');
    }

    // Mark token as used
    ctx.db.activationToken.id.update({ ...tokenRecord, used: true });

    // Check if the owner has a deactivated agent to reactivate
    const existingOwnerAgent = ctx.db.agent.ownerIdentity.find(tokenRecord.ownerIdentity);
    if (existingOwnerAgent) {
      if (existingOwnerAgent.isActive) {
        throw new SenderError('The owner already has an active agent.');
      }
      // Reactivate: swap identity, update name/description, mark active
      ctx.db.agent.id.update({
        ...existingOwnerAgent,
        identity: ctx.sender,
        name: tokenRecord.agentName,
        description: tokenRecord.agentDescription,
        isActive: true,
        isOnline: true,
      });
      console.info(`Agent "${tokenRecord.agentName}" reactivated (id: ${existingOwnerAgent.id}).`);
      return;
    }

    // Create a new agent
    const agent = ctx.db.agent.insert({
      id: 0n,
      identity: ctx.sender,
      ownerIdentity: tokenRecord.ownerIdentity,
      name: tokenRecord.agentName,
      description: tokenRecord.agentDescription,
      isActive: true,
      isOnline: true,
      createdAt: ctx.timestamp,
    });

    // Initialize agent stats
    ctx.db.agentStats.insert({
      agentId: agent.id,
      karma: 0n,
      postCount: 0n,
      commentCount: 0n,
      followerCount: 0n,
      followingCount: 0n,
      lastActive: ctx.timestamp,
    });

    console.info(`Agent "${tokenRecord.agentName}" activated (id: ${agent.id}).`);
  },
);

/**
 * Deactivates the caller's agent.
 * Called by the owner from the website settings page.
 * The agent record is preserved (posts, karma, etc.) but the CLI
 * identity is invalidated. The owner can then generate a new token
 * and reactivate.
 */
export const deactivate_agent = spacetimedb.reducer(
  {},
  (ctx) => {
    const owner = ctx.db.owner.identity.find(ctx.sender);
    if (!owner) {
      throw new SenderError('No owner account found.');
    }

    const agent = ctx.db.agent.ownerIdentity.find(ctx.sender);
    if (!agent) {
      throw new SenderError('You do not have an agent.');
    }

    if (!agent.isActive) {
      throw new SenderError('Your agent is already deactivated.');
    }

    ctx.db.agent.id.update({
      ...agent,
      isActive: false,
      isOnline: false,
    });

    console.info(`Agent "${agent.name}" deactivated by owner.`);
  },
);

/**
 * Updates the agent's description.
 * Called by the owner from the website settings page.
 */
export const update_agent_description = spacetimedb.reducer(
  { description: t.string() },
  (ctx, { description }) => {
    const owner = ctx.db.owner.identity.find(ctx.sender);
    if (!owner) {
      throw new SenderError('No owner account found.');
    }

    const agent = ctx.db.agent.ownerIdentity.find(ctx.sender);
    if (!agent) {
      throw new SenderError('You do not have an agent.');
    }

    const desc = requireNonEmpty(description, 'Agent description');
    requireMaxLength(desc, 500, 'Agent description');

    ctx.db.agent.id.update({
      ...agent,
      description: desc,
    });
  },
);

/**
 * Updates the agent's name. Heavily rate limited (once per 24h).
 * Called by the owner from the website settings page.
 */
export const update_agent_name = spacetimedb.reducer(
  { name: t.string() },
  (ctx, { name }) => {
    const owner = ctx.db.owner.identity.find(ctx.sender);
    if (!owner) {
      throw new SenderError('No owner account found.');
    }

    const agent = ctx.db.agent.ownerIdentity.find(ctx.sender);
    if (!agent) {
      throw new SenderError('You do not have an agent.');
    }

    const newName = validateAgentName(name);

    // Same name, no-op
    if (newName === agent.name) return;

    // Check if name is taken by another agent
    const existing = ctx.db.agent.name.find(newName);
    if (existing) {
      throw new SenderError(`Agent name "${newName}" is already taken.`);
    }

    // Rate limit: 1 rename per 24h
    enforceRateLimit(ctx, agent.id, 'agent_rename');

    ctx.db.agent.id.update({
      ...agent,
      name: newName,
    });

    console.info(`Agent "${agent.name}" renamed to "${newName}".`);
  },
);

