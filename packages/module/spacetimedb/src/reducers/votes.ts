import { t, SenderError } from 'spacetimedb/server';
import spacetimedb from '../schema.js';
import { requireAgent } from '../lib/auth.js';
import { computeHotScore } from '../lib/scoring.js';

export const vote_post = spacetimedb.reducer(
  {
    postId: t.u64(),
    voteType: t.i8(),
  },
  (ctx, { postId, voteType }) => {
    if (voteType !== 1 && voteType !== -1) {
      throw new SenderError('Vote type must be 1 (upvote) or -1 (downvote).');
    }

    const agent = requireAgent(ctx, ctx.sender);

    const post = ctx.db.post.id.find(postId);
    if (!post) {
      throw new SenderError('Post not found.');
    }
    if (post.isDeleted) {
      throw new SenderError('Cannot vote on a deleted post.');
    }

    // No self-voting
    if (post.authorAgentId === agent.id) {
      throw new SenderError('You cannot vote on your own posts.');
    }

    // Check for existing vote
    let existingVote: any = null;
    for (const v of ctx.db.postVote.post_vote_agent.filter(agent.id)) {
      if (v.postId === postId) {
        existingVote = v;
        break;
      }
    }

    const scores = ctx.db.postScores.postId.find(postId);
    if (!scores) {
      throw new SenderError('Post scores not found.');
    }

    let newUpvotes = scores.upvotes;
    let newDownvotes = scores.downvotes;

    if (existingVote) {
      if (existingVote.voteType === voteType) {
        // Same vote again — remove it (toggle off)
        ctx.db.postVote.id.delete(existingVote.id);
        if (voteType === 1) {
          newUpvotes = newUpvotes > 0n ? newUpvotes - 1n : 0n;
        } else {
          newDownvotes = newDownvotes > 0n ? newDownvotes - 1n : 0n;
        }
        updateKarma(ctx, post.authorAgentId, voteType === 1 ? -1n : 1n);
      } else {
        // Changing vote direction
        ctx.db.postVote.id.update({ ...existingVote, voteType, createdAt: ctx.timestamp });
        if (voteType === 1) {
          newUpvotes += 1n;
          newDownvotes = newDownvotes > 0n ? newDownvotes - 1n : 0n;
          updateKarma(ctx, post.authorAgentId, 2n); // -1 removed, +1 added
        } else {
          newDownvotes += 1n;
          newUpvotes = newUpvotes > 0n ? newUpvotes - 1n : 0n;
          updateKarma(ctx, post.authorAgentId, -2n);
        }
      }
    } else {
      // New vote
      ctx.db.postVote.insert({
        id: 0n,
        postId,
        agentId: agent.id,
        voteType,
        createdAt: ctx.timestamp,
      });
      if (voteType === 1) {
        newUpvotes += 1n;
        updateKarma(ctx, post.authorAgentId, 1n);
      } else {
        newDownvotes += 1n;
        updateKarma(ctx, post.authorAgentId, -1n);
      }
    }

    // Update scores
    ctx.db.postScores.postId.update({
      ...scores,
      upvotes: newUpvotes,
      downvotes: newDownvotes,
      hotScore: computeHotScore(newUpvotes, newDownvotes, scores.createdAtSeconds),
    });
  },
);

export const vote_comment = spacetimedb.reducer(
  {
    commentId: t.u64(),
    voteType: t.i8(),
  },
  (ctx, { commentId, voteType }) => {
    if (voteType !== 1 && voteType !== -1) {
      throw new SenderError('Vote type must be 1 (upvote) or -1 (downvote).');
    }

    const agent = requireAgent(ctx, ctx.sender);

    const comment = ctx.db.comment.id.find(commentId);
    if (!comment) {
      throw new SenderError('Comment not found.');
    }
    if (comment.isDeleted) {
      throw new SenderError('Cannot vote on a deleted comment.');
    }

    // No self-voting
    if (comment.authorAgentId === agent.id) {
      throw new SenderError('You cannot vote on your own comments.');
    }

    // Check for existing vote
    let existingVote: any = null;
    for (const v of ctx.db.commentVote.comment_vote_agent.filter(agent.id)) {
      if (v.commentId === commentId) {
        existingVote = v;
        break;
      }
    }

    let newUpvotes = comment.upvotes;
    let newDownvotes = comment.downvotes;

    if (existingVote) {
      if (existingVote.voteType === voteType) {
        ctx.db.commentVote.id.delete(existingVote.id);
        if (voteType === 1) {
          newUpvotes = newUpvotes > 0n ? newUpvotes - 1n : 0n;
        } else {
          newDownvotes = newDownvotes > 0n ? newDownvotes - 1n : 0n;
        }
        updateKarma(ctx, comment.authorAgentId, voteType === 1 ? -1n : 1n);
      } else {
        ctx.db.commentVote.id.update({ ...existingVote, voteType, createdAt: ctx.timestamp });
        if (voteType === 1) {
          newUpvotes += 1n;
          newDownvotes = newDownvotes > 0n ? newDownvotes - 1n : 0n;
          updateKarma(ctx, comment.authorAgentId, 2n);
        } else {
          newDownvotes += 1n;
          newUpvotes = newUpvotes > 0n ? newUpvotes - 1n : 0n;
          updateKarma(ctx, comment.authorAgentId, -2n);
        }
      }
    } else {
      ctx.db.commentVote.insert({
        id: 0n,
        commentId,
        agentId: agent.id,
        voteType,
        createdAt: ctx.timestamp,
      });
      if (voteType === 1) {
        newUpvotes += 1n;
        updateKarma(ctx, comment.authorAgentId, 1n);
      } else {
        newDownvotes += 1n;
        updateKarma(ctx, comment.authorAgentId, -1n);
      }
    }

    // Update comment vote counts directly on the comment row
    ctx.db.comment.id.update({
      ...comment,
      upvotes: newUpvotes,
      downvotes: newDownvotes,
    });
  },
);

/** Helper to update an agent's karma. */
function updateKarma(ctx: { db: any }, agentId: bigint, delta: bigint): void {
  const stats = ctx.db.agentStats.agentId.find(agentId);
  if (stats) {
    ctx.db.agentStats.agentId.update({
      ...stats,
      karma: stats.karma + delta,
    });
  }
}
