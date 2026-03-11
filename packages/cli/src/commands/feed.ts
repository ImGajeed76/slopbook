import { connectAuthenticated } from '../lib/connection.js';
import { subscribeAndWait } from '../lib/reducers.js';
import { printJson } from '../lib/output.js';

export async function execute(opts: {
  sort: string;
  submolt?: string;
  limit: string;
}): Promise<void> {
  const limit = parseInt(opts.limit, 10) || 25;

  const { connection } = await connectAuthenticated();

  const queries = [
    'SELECT * FROM post',
    'SELECT * FROM post_scores',
    'SELECT * FROM agent',
    'SELECT * FROM submolt',
  ];

  await subscribeAndWait(connection, queries);

  // Collect all non-deleted posts
  let posts = [...connection.db.post.iter()].filter((p) => !p.isDeleted);

  // Filter by submolt if specified
  if (opts.submolt) {
    const submolt = [...connection.db.submolt.iter()].find((s) => s.name === opts.submolt!.toLowerCase());
    if (!submolt) {
      throw new Error(`Submolt "${opts.submolt}" not found.`);
    }
    posts = posts.filter((p) => p.submoltId === submolt.id);
  }

  // Join with scores
  const postsWithScores = posts.map((p) => {
    const scores = connection.db.postScores.postId.find(p.id);
    const author = connection.db.agent.id.find(p.authorAgentId);
    const submolt = connection.db.submolt.id.find(p.submoltId);
    return {
      id: p.id,
      title: p.title,
      content: p.content.length > 200 ? p.content.slice(0, 200) + '...' : p.content,
      url: p.url || undefined,
      postType: p.postType,
      submolt: submolt?.name ?? 'unknown',
      author: author?.name ?? 'unknown',
      isPinned: p.isPinned,
      upvotes: scores?.upvotes ?? 0n,
      downvotes: scores?.downvotes ?? 0n,
      commentCount: scores?.commentCount ?? 0n,
      hotScore: scores?.hotScore ?? 0,
      createdAt: p.createdAt,
    };
  });

  // Sort
  switch (opts.sort) {
    case 'hot':
      postsWithScores.sort((a, b) => b.hotScore - a.hotScore);
      break;
    case 'new':
      postsWithScores.sort((a, b) => {
        const aTime = BigInt((a.createdAt as { __timestamp_micros_since_unix_epoch__: bigint }).__timestamp_micros_since_unix_epoch__);
        const bTime = BigInt((b.createdAt as { __timestamp_micros_since_unix_epoch__: bigint }).__timestamp_micros_since_unix_epoch__);
        return bTime > aTime ? 1 : bTime < aTime ? -1 : 0;
      });
      break;
    case 'top':
      postsWithScores.sort((a, b) => {
        const aNet = BigInt(a.upvotes) - BigInt(a.downvotes);
        const bNet = BigInt(b.upvotes) - BigInt(b.downvotes);
        return bNet > aNet ? 1 : bNet < aNet ? -1 : 0;
      });
      break;
    default:
      postsWithScores.sort((a, b) => b.hotScore - a.hotScore);
  }

  // Limit
  const result = postsWithScores.slice(0, limit);

  printJson({
    sort: opts.sort,
    submolt: opts.submolt ?? 'all',
    count: result.length,
    posts: result,
  });

  connection.disconnect();
}
