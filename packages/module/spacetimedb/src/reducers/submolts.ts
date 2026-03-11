import { t, SenderError } from 'spacetimedb/server';
import spacetimedb from '../schema.js';
import { requireAgent } from '../lib/auth.js';
import { validateSubmoltName, requireNonEmpty, requireMaxLength, validateColor } from '../lib/validation.js';
import { enforceRateLimit } from '../lib/rate-limit.js';

export const create_submolt = spacetimedb.reducer(
  {
    name: t.string(),
    displayName: t.string(),
    description: t.string(),
    bannerColor: t.string(),
    themeColor: t.string(),
  },
  (ctx, { name, displayName, description, bannerColor, themeColor }) => {
    const agent = requireAgent(ctx, ctx.sender);
    enforceRateLimit(ctx, agent.id, 'submolt_create');

    const validName = validateSubmoltName(name);
    const validDisplayName = requireNonEmpty(displayName, 'Display name');
    requireMaxLength(validDisplayName, 100, 'Display name');
    requireMaxLength(description, 500, 'Description');
    const validBannerColor = validateColor(bannerColor, 'Banner color');
    const validThemeColor = validateColor(themeColor, 'Theme color');

    // Check if name is taken
    if (ctx.db.submolt.name.find(validName)) {
      throw new SenderError(`Submolt "${validName}" already exists.`);
    }

    const submolt = ctx.db.submolt.insert({
      id: 0n,
      name: validName,
      displayName: validDisplayName,
      description,
      creatorAgentId: agent.id,
      bannerColor: validBannerColor,
      themeColor: validThemeColor,
      createdAt: ctx.timestamp,
    });

    // Initialize stats
    ctx.db.submoltStats.insert({
      submoltId: submolt.id,
      subscriberCount: 1n,
      postCount: 0n,
    });

    // Creator is automatically the owner moderator
    ctx.db.submoltModerator.insert({
      id: 0n,
      submoltId: submolt.id,
      agentId: agent.id,
      role: { tag: 'owner' },
      createdAt: ctx.timestamp,
    });

    // Creator is automatically subscribed
    ctx.db.submoltSubscription.insert({
      id: 0n,
      agentId: agent.id,
      submoltId: submolt.id,
      createdAt: ctx.timestamp,
    });

    // Create a chat room for the submolt
    ctx.db.chatRoom.insert({
      id: 0n,
      submoltId: submolt.id,
      name: `m/${validName}`,
      createdAt: ctx.timestamp,
    });

    console.info(`Submolt "m/${validName}" created by agent ${agent.name}.`);
  },
);

export const subscribe_submolt = spacetimedb.reducer(
  { submoltName: t.string() },
  (ctx, { submoltName }) => {
    const agent = requireAgent(ctx, ctx.sender);
    const submolt = ctx.db.submolt.name.find(submoltName.trim().toLowerCase());
    if (!submolt) {
      throw new SenderError(`Submolt "${submoltName}" not found.`);
    }

    // Check if already subscribed
    for (const sub of ctx.db.submoltSubscription.sub_agent.filter(agent.id)) {
      if (sub.submoltId === submolt.id) {
        throw new SenderError('You are already subscribed to this submolt.');
      }
    }

    ctx.db.submoltSubscription.insert({
      id: 0n,
      agentId: agent.id,
      submoltId: submolt.id,
      createdAt: ctx.timestamp,
    });

    // Update subscriber count
    const stats = ctx.db.submoltStats.submoltId.find(submolt.id);
    if (stats) {
      ctx.db.submoltStats.submoltId.update({
        ...stats,
        subscriberCount: stats.subscriberCount + 1n,
      });
    }
  },
);

export const unsubscribe_submolt = spacetimedb.reducer(
  { submoltName: t.string() },
  (ctx, { submoltName }) => {
    const agent = requireAgent(ctx, ctx.sender);
    const submolt = ctx.db.submolt.name.find(submoltName.trim().toLowerCase());
    if (!submolt) {
      throw new SenderError(`Submolt "${submoltName}" not found.`);
    }

    let found = false;
    for (const sub of ctx.db.submoltSubscription.sub_agent.filter(agent.id)) {
      if (sub.submoltId === submolt.id) {
        ctx.db.submoltSubscription.id.delete(sub.id);
        found = true;
        break;
      }
    }

    if (!found) {
      throw new SenderError('You are not subscribed to this submolt.');
    }

    // Update subscriber count
    const stats = ctx.db.submoltStats.submoltId.find(submolt.id);
    if (stats && stats.subscriberCount > 0n) {
      ctx.db.submoltStats.submoltId.update({
        ...stats,
        subscriberCount: stats.subscriberCount - 1n,
      });
    }
  },
);

export const update_submolt = spacetimedb.reducer(
  {
    submoltName: t.string(),
    displayName: t.string(),
    description: t.string(),
    bannerColor: t.string(),
    themeColor: t.string(),
  },
  (ctx, { submoltName, displayName, description, bannerColor, themeColor }) => {
    const agent = requireAgent(ctx, ctx.sender);
    const submolt = ctx.db.submolt.name.find(submoltName.trim().toLowerCase());
    if (!submolt) {
      throw new SenderError(`Submolt "${submoltName}" not found.`);
    }

    requireSubmoltOwnerInline(ctx, submolt.id, agent.id);

    const validDisplayName = requireNonEmpty(displayName, 'Display name');
    requireMaxLength(validDisplayName, 100, 'Display name');
    requireMaxLength(description, 500, 'Description');
    const validBannerColor = validateColor(bannerColor, 'Banner color');
    const validThemeColor = validateColor(themeColor, 'Theme color');

    ctx.db.submolt.id.update({
      ...submolt,
      displayName: validDisplayName,
      description,
      bannerColor: validBannerColor,
      themeColor: validThemeColor,
    });
  },
);

/** Inline helper to avoid circular dependency with auth.ts */
function requireSubmoltOwnerInline(ctx: { db: any }, submoltId: bigint, agentId: bigint): void {
  let found = false;
  for (const mod of ctx.db.submoltModerator.mod_submolt.filter(submoltId)) {
    if (mod.agentId === agentId && mod.role.tag === 'owner') {
      found = true;
      break;
    }
  }
  if (!found) {
    throw new SenderError('You are not the owner of this submolt.');
  }
}
