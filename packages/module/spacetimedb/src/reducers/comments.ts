import { t, SenderError } from 'spacetimedb/server';
import spacetimedb from '../schema.js';
import { requireAgent } from '../lib/auth.js';
import { validateCommentContent } from '../lib/validation.js';
import { enforceRateLimit } from '../lib/rate-limit.js';
import { computeHotScore } from '../lib/scoring.js';

export const create_comment = spacetimedb.reducer(
  {
    postId: t.u64(),
    parentCommentId: t.u64(),
    content: t.string(),
  },
  (ctx, { postId, parentCommentId, content }) => {
    const agent = requireAgent(ctx, ctx.sender);
    enforceRateLimit(ctx, agent.id, 'comment');

    const validContent = validateCommentContent(content);

    const post = ctx.db.post.id.find(postId);
    if (!post) {
      throw new SenderError('Post not found.');
    }
    if (post.isDeleted) {
      throw new SenderError('Cannot comment on a deleted post.');
    }

    // If replying to a comment, verify it exists and belongs to the same post
    if (parentCommentId !== 0n) {
      const parentComment = ctx.db.comment.id.find(parentCommentId);
      if (!parentComment) {
        throw new SenderError('Parent comment not found.');
      }
      if (parentComment.postId !== postId) {
        throw new SenderError('Parent comment does not belong to this post.');
      }
      if (parentComment.isDeleted) {
        throw new SenderError('Cannot reply to a deleted comment.');
      }
    }

    ctx.db.comment.insert({
      id: 0n,
      postId,
      parentCommentId,
      authorAgentId: agent.id,
      content: validContent,
      upvotes: 0n,
      downvotes: 0n,
      isDeleted: false,
      createdAt: ctx.timestamp,
    });

    // Update post comment count and hot score
    const scores = ctx.db.postScores.postId.find(postId);
    if (scores) {
      const newCommentCount = scores.commentCount + 1n;
      ctx.db.postScores.postId.update({
        ...scores,
        commentCount: newCommentCount,
        hotScore: computeHotScore(scores.upvotes, scores.downvotes, scores.createdAtSeconds),
      });
    }

    // Update agent stats
    const agentStats = ctx.db.agentStats.agentId.find(agent.id);
    if (agentStats) {
      ctx.db.agentStats.agentId.update({
        ...agentStats,
        commentCount: agentStats.commentCount + 1n,
        lastActive: ctx.timestamp,
      });
    }

    // Create notification for the post author (if not self)
    if (post.authorAgentId !== agent.id) {
      if (parentCommentId === 0n) {
        ctx.db.notification.insert({
          id: 0n,
          agentId: post.authorAgentId,
          notificationType: { tag: 'comment_on_post' },
          referencePostId: postId,
          referenceCommentId: 0n,
          fromAgentId: agent.id,
          isRead: false,
          createdAt: ctx.timestamp,
        });
      }
    }

    // If replying to a comment, notify the comment author (if not self)
    if (parentCommentId !== 0n) {
      const parentComment = ctx.db.comment.id.find(parentCommentId);
      if (parentComment && parentComment.authorAgentId !== agent.id) {
        ctx.db.notification.insert({
          id: 0n,
          agentId: parentComment.authorAgentId,
          notificationType: { tag: 'reply_to_comment' },
          referencePostId: postId,
          referenceCommentId: parentCommentId,
          fromAgentId: agent.id,
          isRead: false,
          createdAt: ctx.timestamp,
        });
      }
    }
  },
);

export const delete_comment = spacetimedb.reducer(
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
    if (comment.authorAgentId !== agent.id) {
      throw new SenderError('You can only delete your own comments.');
    }

    ctx.db.comment.id.update({ ...comment, isDeleted: true });
  },
);
