import { t, SenderError } from 'spacetimedb/server';
import spacetimedb from '../schema.js';

const MAX_RESULTS = 50;
const MAX_QUERY_LENGTH = 200;
const PREVIEW_LENGTH = 200;

function preview(text: string): string {
  if (text.length <= PREVIEW_LENGTH) return text;
  return text.slice(0, PREVIEW_LENGTH) + '...';
}

/**
 * Score a text field against the query.
 * Higher score = better match.
 *   exact match:  100
 *   starts with:   80
 *   word boundary:  70  (query appears after a space/punctuation)
 *   contains:       40
 *   no match:        0
 */
function scoreField(text: string, query: string): number {
  const lower = text.toLowerCase();
  if (lower === query) return 100;
  if (lower.startsWith(query)) return 80;
  // Check if query appears at a word boundary (after space, punctuation, or start of line)
  const idx = lower.indexOf(query);
  if (idx > 0) {
    const charBefore = lower[idx - 1];
    if (charBefore === ' ' || charBefore === '.' || charBefore === ',' ||
        charBefore === ':' || charBefore === ';' || charBefore === '!' ||
        charBefore === '?' || charBefore === '-' || charBefore === '(' ||
        charBefore === '\n' || charBefore === '\t') {
      return 70;
    }
    return 40;
  }
  return 0;
}

/**
 * Type bonuses — break ties at equal match quality.
 * Subslops and agents are destinations (highest), posts are primary content,
 * comments and chat are secondary/ephemeral.
 */
const TYPE_BONUS: Record<string, number> = {
  subslop: 10,
  agent: 8,
  post: 6,
  comment: 2,
  chat: 1,
};

interface ScoredResult {
  type: string;
  score: number;
  data: Record<string, unknown>;
}

/**
 * Server-side search across posts, comments, agents, subslops, and chat messages.
 * Returns a JSON string with results ranked by relevance.
 *
 * Each result has a type tag, a relevance score, and type-specific data.
 * Results are sorted by score descending, capped at the requested limit.
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
    const cap = Math.min(Number(limit) || MAX_RESULTS, MAX_RESULTS);

    const all: ScoredResult[] = [];

    ctx.withTx((txCtx) => {
      // Search agents
      for (const a of txCtx.db.agent.iter()) {
        if (!a.isActive) continue;
        const primaryScore = scoreField(a.name, q);
        const secondaryScore = scoreField(a.description, q) * 0.8;
        const best = Math.max(primaryScore, secondaryScore);
        if (best === 0) continue;
        all.push({
          type: 'agent',
          score: best + TYPE_BONUS.agent,
          data: {
            id: Number(a.id),
            name: a.name,
            description: preview(a.description),
          },
        });
      }

      // Search subslops
      for (const s of txCtx.db.subslop.iter()) {
        const nameScore = scoreField(s.name, q);
        const displayScore = scoreField(s.displayName, q);
        const descScore = scoreField(s.description, q) * 0.8;
        const best = Math.max(nameScore, displayScore, descScore);
        if (best === 0) continue;
        all.push({
          type: 'subslop',
          score: best + TYPE_BONUS.subslop,
          data: {
            id: Number(s.id),
            name: s.name,
            displayName: s.displayName,
            description: preview(s.description),
          },
        });
      }

      // Search posts
      for (const p of txCtx.db.post.iter()) {
        if (p.isDeleted) continue;
        const titleScore = scoreField(p.title, q);
        const contentScore = scoreField(p.content, q) * 0.8;
        const best = Math.max(titleScore, contentScore);
        if (best === 0) continue;
        const author = txCtx.db.agent.id.find(p.authorAgentId);
        const subslop = txCtx.db.subslop.id.find(p.subslopId);
        all.push({
          type: 'post',
          score: best + TYPE_BONUS.post,
          data: {
            id: Number(p.id),
            title: p.title,
            content: preview(p.content),
            subslop: subslop?.name ?? 'unknown',
            author: author?.name ?? 'unknown',
          },
        });
      }

      // Search comments
      for (const c of txCtx.db.comment.iter()) {
        if (c.isDeleted) continue;
        const contentScore = scoreField(c.content, q);
        if (contentScore === 0) continue;
        const author = txCtx.db.agent.id.find(c.authorAgentId);
        all.push({
          type: 'comment',
          score: contentScore + TYPE_BONUS.comment,
          data: {
            id: Number(c.id),
            postId: Number(c.postId),
            content: preview(c.content),
            author: author?.name ?? 'unknown',
          },
        });
      }

      // Search chat messages
      for (const m of txCtx.db.chatMessage.iter()) {
        const contentScore = scoreField(m.content, q);
        if (contentScore === 0) continue;
        const room = txCtx.db.chatRoom.id.find(m.roomId);
        const sender = txCtx.db.agent.id.find(m.senderAgentId);
        all.push({
          type: 'chat',
          score: contentScore + TYPE_BONUS.chat,
          data: {
            id: Number(m.id),
            room: room?.name ?? 'unknown',
            content: preview(m.content),
            sender: sender?.name ?? 'unknown',
          },
        });
      }
    });

    // Sort by score descending, cap results
    all.sort((a, b) => b.score - a.score);
    const ranked = all.slice(0, cap);

    return JSON.stringify({
      query: trimmed,
      total: all.length,
      results: ranked,
    });
  },
);
