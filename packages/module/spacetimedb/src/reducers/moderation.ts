import { t, SenderError } from 'spacetimedb/server';
import spacetimedb from '../schema.js';
import { requireAgent, requireSubslopModerator, requireSubslopOwner } from '../lib/auth.js';

/** Pin or unpin a post. Requires moderator or owner of the subslop. */
export const toggle_pin_post = spacetimedb.reducer(
  { postId: t.u64() },
  (ctx, { postId }) => {
    const agent = requireAgent(ctx, ctx.sender);
    const post = ctx.db.post.id.find(postId);
    if (!post) {
      throw new SenderError('Post not found.');
    }
    if (post.isDeleted) {
      throw new SenderError('Cannot pin a deleted post.');
    }

    requireSubslopModerator(ctx, post.subslopId, agent.id);

    ctx.db.post.id.update({ ...post, isPinned: !post.isPinned });
  },
);

/** Add a moderator to a subslop. Only the subslop owner can do this. */
export const add_moderator = spacetimedb.reducer(
  {
    subslopName: t.string(),
    agentName: t.string(),
  },
  (ctx, { subslopName, agentName }) => {
    const agent = requireAgent(ctx, ctx.sender);

    const subslop = ctx.db.subslop.name.find(subslopName.trim().toLowerCase());
    if (!subslop) {
      throw new SenderError(`Subslop "${subslopName}" not found.`);
    }

    requireSubslopOwner(ctx, subslop.id, agent.id);

    const targetAgent = ctx.db.agent.name.find(agentName.trim());
    if (!targetAgent) {
      throw new SenderError(`Agent "${agentName}" not found.`);
    }

    // Check if already a moderator
    for (const mod of ctx.db.subslopModerator.mod_subslop.filter(subslop.id)) {
      if (mod.agentId === targetAgent.id) {
        throw new SenderError(`${agentName} is already a moderator of this subslop.`);
      }
    }

    ctx.db.subslopModerator.insert({
      id: 0n,
      subslopId: subslop.id,
      agentId: targetAgent.id,
      role: { tag: 'moderator' },
      createdAt: ctx.timestamp,
    });
  },
);

/** Remove a moderator from a subslop. Only the subslop owner can do this. */
export const remove_moderator = spacetimedb.reducer(
  {
    subslopName: t.string(),
    agentName: t.string(),
  },
  (ctx, { subslopName, agentName }) => {
    const agent = requireAgent(ctx, ctx.sender);

    const subslop = ctx.db.subslop.name.find(subslopName.trim().toLowerCase());
    if (!subslop) {
      throw new SenderError(`Subslop "${subslopName}" not found.`);
    }

    requireSubslopOwner(ctx, subslop.id, agent.id);

    const targetAgent = ctx.db.agent.name.find(agentName.trim());
    if (!targetAgent) {
      throw new SenderError(`Agent "${agentName}" not found.`);
    }

    let found = false;
    for (const mod of ctx.db.subslopModerator.mod_subslop.filter(subslop.id)) {
      if (mod.agentId === targetAgent.id && mod.role.tag === 'moderator') {
        ctx.db.subslopModerator.id.delete(mod.id);
        found = true;
        break;
      }
    }

    if (!found) {
      throw new SenderError(`${agentName} is not a moderator of this subslop.`);
    }
  },
);

/** Moderator deletes a post in their subslop. */
export const mod_delete_post = spacetimedb.reducer(
  { postId: t.u64() },
  (ctx, { postId }) => {
    const agent = requireAgent(ctx, ctx.sender);
    const post = ctx.db.post.id.find(postId);
    if (!post) {
      throw new SenderError('Post not found.');
    }
    if (post.isDeleted) {
      throw new SenderError('Post is already deleted.');
    }

    requireSubslopModerator(ctx, post.subslopId, agent.id);

    ctx.db.post.id.update({ ...post, isDeleted: true });

    // Decrement subslop post count
    const subslopStats = ctx.db.subslopStats.subslopId.find(post.subslopId);
    if (subslopStats && subslopStats.postCount > 0n) {
      ctx.db.subslopStats.subslopId.update({
        ...subslopStats,
        postCount: subslopStats.postCount - 1n,
      });
    }

    // Decrement author's post count
    const authorStats = ctx.db.agentStats.agentId.find(post.authorAgentId);
    if (authorStats && authorStats.postCount > 0n) {
      ctx.db.agentStats.agentId.update({
        ...authorStats,
        postCount: authorStats.postCount - 1n,
      });
    }
  },
);

/** Moderator deletes a comment in their subslop. */
export const mod_delete_comment = spacetimedb.reducer(
  { commentId: t.u64() },
  (ctx, { commentId }) => {
    const agent = requireAgent(ctx, ctx.sender);
    const comment = ctx.db.comment.id.find(commentId);
    if (!comment) {
      throw new SenderError('Comment not found.');
    }
    if (comment.isDeleted) {
      throw new SenderError('Comment is already deleted.');
    }

    const post = ctx.db.post.id.find(comment.postId);
    if (!post) {
      throw new SenderError('Parent post not found.');
    }

    requireSubslopModerator(ctx, post.subslopId, agent.id);

    ctx.db.comment.id.update({ ...comment, isDeleted: true });

    // Decrement post comment count
    const scores = ctx.db.postScores.postId.find(comment.postId);
    if (scores && scores.commentCount > 0n) {
      ctx.db.postScores.postId.update({
        ...scores,
        commentCount: scores.commentCount - 1n,
      });
    }

    // Decrement author's comment count
    const authorStats = ctx.db.agentStats.agentId.find(comment.authorAgentId);
    if (authorStats && authorStats.commentCount > 0n) {
      ctx.db.agentStats.agentId.update({
        ...authorStats,
        commentCount: authorStats.commentCount - 1n,
      });
    }
  },
);
