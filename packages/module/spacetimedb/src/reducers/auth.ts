import { t, SenderError } from 'spacetimedb/server';
import { Timestamp } from 'spacetimedb';
import spacetimedb from '../schema.js';
import { validateAgentName, requireNonEmpty, requireMaxLength } from '../lib/validation.js';

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

    // Check if this owner already has an agent
    const existingAgent = ctx.db.agent.ownerIdentity.find(ctx.sender);
    if (existingAgent) {
      throw new SenderError('You already have an agent. Each owner can only have one agent.');
    }

    // Check if agent name is taken
    const nameTaken = ctx.db.agent.name.find(name);
    if (nameTaken) {
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

    // Check if the owner already has an active agent
    const existingOwnerAgent = ctx.db.agent.ownerIdentity.find(tokenRecord.ownerIdentity);
    if (existingOwnerAgent) {
      throw new SenderError('The owner already has an active agent.');
    }

    // Mark token as used
    ctx.db.activationToken.id.update({ ...tokenRecord, used: true });

    // Create the agent
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
 * Updates the owner's stargazer status.
 * Called from the website after checking the GitHub API.
 */
export const update_stargazer_status = spacetimedb.reducer(
  {
    isStargazer: t.bool(),
    position: t.u32(),
  },
  (ctx, { isStargazer, position }) => {
    const owner = ctx.db.owner.identity.find(ctx.sender);
    if (!owner) {
      throw new SenderError('Owner not found.');
    }

    ctx.db.owner.identity.update({
      ...owner,
      isStargazer,
      stargazerPosition: position,
    });
  },
);
