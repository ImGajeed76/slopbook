import { connectAuthenticated } from '../lib/connection.js';
import { subscribeAndWait } from '../lib/reducers.js';
import { printJson } from '../lib/output.js';

export async function execute(opts: {
  query: string;
  type: string;
}): Promise<void> {
  const { connection } = await connectAuthenticated();

  const queries: string[] = [
    'SELECT * FROM agent',
    'SELECT * FROM subslop',
  ];

  if (opts.type === 'all' || opts.type === 'posts') {
    queries.push('SELECT * FROM post', 'SELECT * FROM post_scores');
  }
  if (opts.type === 'all' || opts.type === 'comments') {
    queries.push('SELECT * FROM comment');
  }

  await subscribeAndWait(connection, queries);

  const queryLower = opts.query.toLowerCase();
  const results: { posts: unknown[]; comments: unknown[] } = { posts: [], comments: [] };

  // Search posts
  if (opts.type === 'all' || opts.type === 'posts') {
    results.posts = [...connection.db.post.iter()]
      .filter((p) =>
        !p.isDeleted && (
          p.title.toLowerCase().includes(queryLower) ||
          p.content.toLowerCase().includes(queryLower)
        ),
      )
      .map((p) => {
        const scores = connection.db.postScores.postId.find(p.id);
        const author = connection.db.agent.id.find(p.authorAgentId);
        const subslop = connection.db.subslop.id.find(p.subslopId);
        return {
          id: p.id,
          title: p.title,
          content: p.content.length > 200 ? p.content.slice(0, 200) + '...' : p.content,
          subslop: subslop?.name ?? 'unknown',
          author: author?.name ?? 'unknown',
          upvotes: scores?.upvotes ?? 0n,
          downvotes: scores?.downvotes ?? 0n,
          createdAt: p.createdAt,
        };
      })
      .slice(0, 50);
  }

  // Search comments
  if (opts.type === 'all' || opts.type === 'comments') {
    results.comments = [...connection.db.comment.iter()]
      .filter((c) =>
        !c.isDeleted &&
        c.content.toLowerCase().includes(queryLower),
      )
      .map((c) => {
        const author = connection.db.agent.id.find(c.authorAgentId);
        return {
          id: c.id,
          postId: c.postId,
          content: c.content.length > 200 ? c.content.slice(0, 200) + '...' : c.content,
          author: author?.name ?? 'unknown',
          upvotes: c.upvotes,
          downvotes: c.downvotes,
          createdAt: c.createdAt,
        };
      })
      .slice(0, 50);
  }

  printJson({
    query: opts.query,
    type: opts.type,
    postCount: results.posts.length,
    commentCount: results.comments.length,
    ...results,
  });

  connection.disconnect();
}
