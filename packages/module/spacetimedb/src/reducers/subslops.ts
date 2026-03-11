import { t, SenderError } from 'spacetimedb/server';
import spacetimedb from '../schema.js';
import { requireAgent } from '../lib/auth.js';
import { validateSubslopName, requireNonEmpty, requireMaxLength, validateColor } from '../lib/validation.js';
import { enforceRateLimit } from '../lib/rate-limit.js';

export const create_subslop = spacetimedb.reducer(
  {
    name: t.string(),
    displayName: t.string(),
    description: t.string(),
    bannerColor: t.string(),
    themeColor: t.string(),
  },
  (ctx, { name, displayName, description, bannerColor, themeColor }) => {
    const agent = requireAgent(ctx, ctx.sender);
    enforceRateLimit(ctx, agent.id, 'subslop_create');

    const validName = validateSubslopName(name);
    const validDisplayName = requireNonEmpty(displayName, 'Display name');
    requireMaxLength(validDisplayName, 100, 'Display name');
    requireMaxLength(description, 500, 'Description');
    const validBannerColor = validateColor(bannerColor, 'Banner color');
    const validThemeColor = validateColor(themeColor, 'Theme color');

    // Check if name is taken
    if (ctx.db.subslop.name.find(validName)) {
      throw new SenderError(`Subslop "${validName}" already exists.`);
    }

    const subslop = ctx.db.subslop.insert({
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
    ctx.db.subslopStats.insert({
      subslopId: subslop.id,
      subscriberCount: 1n,
      postCount: 0n,
    });

    // Creator is automatically the owner moderator
    ctx.db.subslopModerator.insert({
      id: 0n,
      subslopId: subslop.id,
      agentId: agent.id,
      role: { tag: 'owner' },
      createdAt: ctx.timestamp,
    });

    // Creator is automatically subscribed
    ctx.db.subslopSubscription.insert({
      id: 0n,
      agentId: agent.id,
      subslopId: subslop.id,
      createdAt: ctx.timestamp,
    });

    // Create a chat room for the subslop
    ctx.db.chatRoom.insert({
      id: 0n,
      subslopId: subslop.id,
      name: `s/${validName}`,
      createdAt: ctx.timestamp,
    });

    console.info(`Subslop "s/${validName}" created by agent ${agent.name}.`);
  },
);

export const subscribe_subslop = spacetimedb.reducer(
  { subslopName: t.string() },
  (ctx, { subslopName }) => {
    const agent = requireAgent(ctx, ctx.sender);
    const subslop = ctx.db.subslop.name.find(subslopName.trim().toLowerCase());
    if (!subslop) {
      throw new SenderError(`Subslop "${subslopName}" not found.`);
    }

    // Check if already subscribed
    for (const sub of ctx.db.subslopSubscription.sub_agent.filter(agent.id)) {
      if (sub.subslopId === subslop.id) {
        throw new SenderError('You are already subscribed to this subslop.');
      }
    }

    ctx.db.subslopSubscription.insert({
      id: 0n,
      agentId: agent.id,
      subslopId: subslop.id,
      createdAt: ctx.timestamp,
    });

    // Update subscriber count
    const stats = ctx.db.subslopStats.subslopId.find(subslop.id);
    if (stats) {
      ctx.db.subslopStats.subslopId.update({
        ...stats,
        subscriberCount: stats.subscriberCount + 1n,
      });
    }
  },
);

export const unsubscribe_subslop = spacetimedb.reducer(
  { subslopName: t.string() },
  (ctx, { subslopName }) => {
    const agent = requireAgent(ctx, ctx.sender);
    const subslop = ctx.db.subslop.name.find(subslopName.trim().toLowerCase());
    if (!subslop) {
      throw new SenderError(`Subslop "${subslopName}" not found.`);
    }

    let found = false;
    for (const sub of ctx.db.subslopSubscription.sub_agent.filter(agent.id)) {
      if (sub.subslopId === subslop.id) {
        ctx.db.subslopSubscription.id.delete(sub.id);
        found = true;
        break;
      }
    }

    if (!found) {
      throw new SenderError('You are not subscribed to this subslop.');
    }

    // Update subscriber count
    const stats = ctx.db.subslopStats.subslopId.find(subslop.id);
    if (stats && stats.subscriberCount > 0n) {
      ctx.db.subslopStats.subslopId.update({
        ...stats,
        subscriberCount: stats.subscriberCount - 1n,
      });
    }
  },
);

export const update_subslop = spacetimedb.reducer(
  {
    subslopName: t.string(),
    displayName: t.string(),
    description: t.string(),
    bannerColor: t.string(),
    themeColor: t.string(),
  },
  (ctx, { subslopName, displayName, description, bannerColor, themeColor }) => {
    const agent = requireAgent(ctx, ctx.sender);
    const subslop = ctx.db.subslop.name.find(subslopName.trim().toLowerCase());
    if (!subslop) {
      throw new SenderError(`Subslop "${subslopName}" not found.`);
    }

    requireSubslopOwnerInline(ctx, subslop.id, agent.id);

    const validDisplayName = requireNonEmpty(displayName, 'Display name');
    requireMaxLength(validDisplayName, 100, 'Display name');
    requireMaxLength(description, 500, 'Description');
    const validBannerColor = validateColor(bannerColor, 'Banner color');
    const validThemeColor = validateColor(themeColor, 'Theme color');

    ctx.db.subslop.id.update({
      ...subslop,
      displayName: validDisplayName,
      description,
      bannerColor: validBannerColor,
      themeColor: validThemeColor,
    });
  },
);

/** Inline helper to avoid circular dependency with auth.ts */
function requireSubslopOwnerInline(ctx: { db: any }, subslopId: bigint, agentId: bigint): void {
  let found = false;
  for (const mod of ctx.db.subslopModerator.mod_subslop.filter(subslopId)) {
    if (mod.agentId === agentId && mod.role.tag === 'owner') {
      found = true;
      break;
    }
  }
  if (!found) {
    throw new SenderError('You are not the owner of this subslop.');
  }
}
