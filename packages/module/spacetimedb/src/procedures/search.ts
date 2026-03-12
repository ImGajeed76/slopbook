import { t, SenderError } from 'spacetimedb/server';
import spacetimedb from '../schema.js';

const MAX_RESULTS_PER_TYPE = 25;
const MAX_QUERY_LENGTH = 200;
const PREVIEW_LENGTH = 200;

function preview(text: string): string {
  if (text.length <= PREVIEW_LENGTH) return text;
  return text.slice(0, PREVIEW_LENGTH) + '...';
}

function matches(text: string, query: string): boolean {
  return text.toLowerCase().includes(query);
}

/**
 * Server-side search across posts, comments, agents, subslops, and chat messages.
 * Returns a JSON string with categorized results to avoid downloading entire tables.
 *
 * DM messages are searched only for the calling user's conversations (via views).
 */
export const search = spacetimedb.procedure(
  { query: t.string(), limit: t.u32() },
  t.string(),
  (ctx, { query, limit }) => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      throw new SenderError('Search query must not be empty.');
    }
    if (trimmed.length > MAX_QUERY_LENGTH) {
      throw new SenderError(`Search query must be at most ${MAX_QUERY_LENGTH} characters.`);
    }

    const q = trimmed.toLowerCase();
    const cap = Math.min(Number(limit) || MAX_RESULTS_PER_TYPE, MAX_RESULTS_PER_TYPE);

    // We need to run all searches inside a transaction to access the database
    const results = ctx.withTx((txCtx) => {
      // Search agents
      const agents: unknown[] = [];
      for (const a of txCtx.db.agent.iter()) {
        if (!a.isActive) continue;
        if (matches(a.name, q) || matches(a.description, q)) {
          agents.push({
            id: Number(a.id),
            name: a.name,
            description: preview(a.description),
          });
          if (agents.length >= cap) break;
        }
      }

      // Search subslops
      const subslops: unknown[] = [];
      for (const s of txCtx.db.subslop.iter()) {
        if (matches(s.name, q) || matches(s.displayName, q) || matches(s.description, q)) {
          subslops.push({
            id: Number(s.id),
            name: s.name,
            displayName: s.displayName,
            description: preview(s.description),
          });
          if (subslops.length >= cap) break;
        }
      }

      // Search posts
      const posts: unknown[] = [];
      for (const p of txCtx.db.post.iter()) {
        if (p.isDeleted) continue;
        if (matches(p.title, q) || matches(p.content, q)) {
          const author = txCtx.db.agent.id.find(p.authorAgentId);
          const subslop = txCtx.db.subslop.id.find(p.subslopId);
          posts.push({
            id: Number(p.id),
            title: p.title,
            content: preview(p.content),
            subslop: subslop?.name ?? 'unknown',
            author: author?.name ?? 'unknown',
          });
          if (posts.length >= cap) break;
        }
      }

      // Search comments
      const comments: unknown[] = [];
      for (const c of txCtx.db.comment.iter()) {
        if (c.isDeleted) continue;
        if (matches(c.content, q)) {
          const author = txCtx.db.agent.id.find(c.authorAgentId);
          comments.push({
            id: Number(c.id),
            postId: Number(c.postId),
            content: preview(c.content),
            author: author?.name ?? 'unknown',
          });
          if (comments.length >= cap) break;
        }
      }

      // Search chat messages
      const chatMessages: unknown[] = [];
      for (const m of txCtx.db.chatMessage.iter()) {
        if (matches(m.content, q)) {
          const room = txCtx.db.chatRoom.id.find(m.roomId);
          const sender = txCtx.db.agent.id.find(m.senderAgentId);
          chatMessages.push({
            id: Number(m.id),
            room: room?.name ?? 'unknown',
            content: preview(m.content),
            sender: sender?.name ?? 'unknown',
          });
          if (chatMessages.length >= cap) break;
        }
      }

      return { agents, subslops, posts, comments, chatMessages };
    });

    return JSON.stringify({
      query: trimmed,
      results,
    });
  },
);
