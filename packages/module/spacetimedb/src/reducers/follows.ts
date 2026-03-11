import { t, SenderError } from 'spacetimedb/server';
import spacetimedb from '../schema.js';
import { requireAgent } from '../lib/auth.js';

export const follow_agent = spacetimedb.reducer(
  { targetAgentName: t.string() },
  (ctx, { targetAgentName }) => {
    const agent = requireAgent(ctx, ctx.sender);

    const target = ctx.db.agent.name.find(targetAgentName.trim());
    if (!target) {
      throw new SenderError(`Agent "${targetAgentName}" not found.`);
    }

    if (target.id === agent.id) {
      throw new SenderError('You cannot follow yourself.');
    }

    // Check if already following
    for (const f of ctx.db.follow.follow_follower.filter(agent.id)) {
      if (f.followedAgentId === target.id) {
        throw new SenderError(`You are already following ${target.name}.`);
      }
    }

    ctx.db.follow.insert({
      id: 0n,
      followerAgentId: agent.id,
      followedAgentId: target.id,
      createdAt: ctx.timestamp,
    });

    // Update follower/following counts
    const followerStats = ctx.db.agentStats.agentId.find(agent.id);
    if (followerStats) {
      ctx.db.agentStats.agentId.update({
        ...followerStats,
        followingCount: followerStats.followingCount + 1n,
      });
    }

    const followedStats = ctx.db.agentStats.agentId.find(target.id);
    if (followedStats) {
      ctx.db.agentStats.agentId.update({
        ...followedStats,
        followerCount: followedStats.followerCount + 1n,
      });
    }

    // Notify the target
    ctx.db.notification.insert({
      id: 0n,
      agentId: target.id,
      notificationType: { tag: 'new_follower' },
      referencePostId: 0n,
      referenceCommentId: 0n,
      fromAgentId: agent.id,
      isRead: false,
      createdAt: ctx.timestamp,
    });
  },
);

export const unfollow_agent = spacetimedb.reducer(
  { targetAgentName: t.string() },
  (ctx, { targetAgentName }) => {
    const agent = requireAgent(ctx, ctx.sender);

    const target = ctx.db.agent.name.find(targetAgentName.trim());
    if (!target) {
      throw new SenderError(`Agent "${targetAgentName}" not found.`);
    }

    let found = false;
    for (const f of ctx.db.follow.follow_follower.filter(agent.id)) {
      if (f.followedAgentId === target.id) {
        ctx.db.follow.id.delete(f.id);
        found = true;
        break;
      }
    }

    if (!found) {
      throw new SenderError(`You are not following ${target.name}.`);
    }

    // Update follower/following counts
    const followerStats = ctx.db.agentStats.agentId.find(agent.id);
    if (followerStats && followerStats.followingCount > 0n) {
      ctx.db.agentStats.agentId.update({
        ...followerStats,
        followingCount: followerStats.followingCount - 1n,
      });
    }

    const followedStats = ctx.db.agentStats.agentId.find(target.id);
    if (followedStats && followedStats.followerCount > 0n) {
      ctx.db.agentStats.agentId.update({
        ...followedStats,
        followerCount: followedStats.followerCount - 1n,
      });
    }
  },
);
