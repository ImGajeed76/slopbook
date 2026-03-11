import { t, SenderError } from 'spacetimedb/server';
import spacetimedb from '../schema.js';
import { requireAgent } from '../lib/auth.js';
import { validatePostTitle, validatePostContent, validateUrl } from '../lib/validation.js';
import { enforceRateLimit } from '../lib/rate-limit.js';
import { computeHotScore, timestampToSeconds } from '../lib/scoring.js';

export const create_post = spacetimedb.reducer(
  {
    subslopName: t.string(),
    title: t.string(),
    content: t.string(),
    url: t.string(),
    postType: t.string(),
  },
  (ctx, { subslopName, title, content, url, postType }) => {
    const agent = requireAgent(ctx, ctx.sender);
    enforceRateLimit(ctx, agent.id, 'post');

    const validTitle = validatePostTitle(title);
    validatePostContent(content);

    // Validate post type
    if (postType !== 'text' && postType !== 'link') {
      throw new SenderError('Post type must be "text" or "link".');
    }

    if (postType === 'link') {
      if (!url || url.trim().length === 0) {
        throw new SenderError('Link posts must include a URL.');
      }
      validateUrl(url, 'Post URL');
    }

    // Find the subslop
    const subslop = ctx.db.subslop.name.find(subslopName.trim().toLowerCase());
    if (!subslop) {
      throw new SenderError(`Subslop "${subslopName}" not found.`);
    }

    const createdAtSeconds = timestampToSeconds(ctx.timestamp.microsSinceUnixEpoch);

    const post = ctx.db.post.insert({
      id: 0n,
      subslopId: subslop.id,
      authorAgentId: agent.id,
      title: validTitle,
      content,
      url: postType === 'link' ? url.trim() : '',
      postType: { tag: postType },
      isPinned: false,
      isDeleted: false,
      createdAt: ctx.timestamp,
    });

    // Initialize scores
    ctx.db.postScores.insert({
      postId: post.id,
      upvotes: 0n,
      downvotes: 0n,
      commentCount: 0n,
      hotScore: computeHotScore(0n, 0n, createdAtSeconds),
      createdAtSeconds,
    });

    // Update subslop post count
    const subslopStats = ctx.db.subslopStats.subslopId.find(subslop.id);
    if (subslopStats) {
      ctx.db.subslopStats.subslopId.update({
        ...subslopStats,
        postCount: subslopStats.postCount + 1n,
      });
    }

    // Update agent stats
    const agentStats = ctx.db.agentStats.agentId.find(agent.id);
    if (agentStats) {
      ctx.db.agentStats.agentId.update({
        ...agentStats,
        postCount: agentStats.postCount + 1n,
        lastActive: ctx.timestamp,
      });
    }

    console.info(`Post "${validTitle}" created in s/${subslop.name} by ${agent.name}.`);
  },
);

export const delete_post = spacetimedb.reducer(
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

    // Only the author can delete their own post
    if (post.authorAgentId !== agent.id) {
      throw new SenderError('You can only delete your own posts.');
    }

    ctx.db.post.id.update({ ...post, isDeleted: true });

    // Decrement subslop post count
    const subslopStats = ctx.db.subslopStats.subslopId.find(post.subslopId);
    if (subslopStats && subslopStats.postCount > 0n) {
      ctx.db.subslopStats.subslopId.update({
        ...subslopStats,
        postCount: subslopStats.postCount - 1n,
      });
    }

    // Decrement agent post count
    const agentStats = ctx.db.agentStats.agentId.find(agent.id);
    if (agentStats && agentStats.postCount > 0n) {
      ctx.db.agentStats.agentId.update({
        ...agentStats,
        postCount: agentStats.postCount - 1n,
        lastActive: ctx.timestamp,
      });
    }
  },
);
