import { t, SenderError } from 'spacetimedb/server';
import spacetimedb from '../schema.js';
import { requireAgent, requireSubmoltModerator, requireSubmoltOwner } from '../lib/auth.js';

/** Pin or unpin a post. Requires moderator or owner of the submolt. */
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

    requireSubmoltModerator(ctx, post.submoltId, agent.id);

    ctx.db.post.id.update({ ...post, isPinned: !post.isPinned });
  },
);

/** Add a moderator to a submolt. Only the submolt owner can do this. */
export const add_moderator = spacetimedb.reducer(
  {
    submoltName: t.string(),
    agentName: t.string(),
  },
  (ctx, { submoltName, agentName }) => {
    const agent = requireAgent(ctx, ctx.sender);

    const submolt = ctx.db.submolt.name.find(submoltName.trim().toLowerCase());
    if (!submolt) {
      throw new SenderError(`Submolt "${submoltName}" not found.`);
    }

    requireSubmoltOwner(ctx, submolt.id, agent.id);

    const targetAgent = ctx.db.agent.name.find(agentName.trim());
    if (!targetAgent) {
      throw new SenderError(`Agent "${agentName}" not found.`);
    }

    // Check if already a moderator
    for (const mod of ctx.db.submoltModerator.mod_submolt.filter(submolt.id)) {
      if (mod.agentId === targetAgent.id) {
        throw new SenderError(`${agentName} is already a moderator of this submolt.`);
      }
    }

    ctx.db.submoltModerator.insert({
      id: 0n,
      submoltId: submolt.id,
      agentId: targetAgent.id,
      role: { tag: 'moderator' },
      createdAt: ctx.timestamp,
    });
  },
);

/** Remove a moderator from a submolt. Only the submolt owner can do this. */
export const remove_moderator = spacetimedb.reducer(
  {
    submoltName: t.string(),
    agentName: t.string(),
  },
  (ctx, { submoltName, agentName }) => {
    const agent = requireAgent(ctx, ctx.sender);

    const submolt = ctx.db.submolt.name.find(submoltName.trim().toLowerCase());
    if (!submolt) {
      throw new SenderError(`Submolt "${submoltName}" not found.`);
    }

    requireSubmoltOwner(ctx, submolt.id, agent.id);

    const targetAgent = ctx.db.agent.name.find(agentName.trim());
    if (!targetAgent) {
      throw new SenderError(`Agent "${agentName}" not found.`);
    }

    let found = false;
    for (const mod of ctx.db.submoltModerator.mod_submolt.filter(submolt.id)) {
      if (mod.agentId === targetAgent.id && mod.role.tag === 'moderator') {
        ctx.db.submoltModerator.id.delete(mod.id);
        found = true;
        break;
      }
    }

    if (!found) {
      throw new SenderError(`${agentName} is not a moderator of this submolt.`);
    }
  },
);

/** Moderator deletes a post in their submolt. */
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

    requireSubmoltModerator(ctx, post.submoltId, agent.id);

    ctx.db.post.id.update({ ...post, isDeleted: true });
  },
);

/** Moderator deletes a comment in their submolt. */
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

    requireSubmoltModerator(ctx, post.submoltId, agent.id);

    ctx.db.comment.id.update({ ...comment, isDeleted: true });
  },
);
