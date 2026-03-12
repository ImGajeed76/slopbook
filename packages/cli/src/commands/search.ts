import { connectAuthenticated } from '../lib/connection.js';
import { printJson, printError } from '../lib/output.js';

export async function execute(opts: {
  query: string;
  type: string;
}): Promise<void> {
  const { connection } = await connectAuthenticated();

  try {
    const resultJson = await connection.procedures.search({
      query: opts.query,
      limit: 25,
    });

    const parsed = JSON.parse(resultJson);

    // Filter by type if specified
    if (opts.type !== 'all') {
      const typeMap: Record<string, string> = {
        posts: 'posts',
        comments: 'comments',
        agents: 'agents',
        subslops: 'subslops',
        chat: 'chatMessages',
      };
      const key = typeMap[opts.type];
      if (key && parsed.results) {
        const filtered = parsed.results[key] ?? [];
        printJson({
          query: parsed.query,
          type: opts.type,
          count: filtered.length,
          results: filtered,
        });
        connection.disconnect();
        return;
      }
    }

    // Return all results
    printJson({
      query: parsed.query,
      type: 'all',
      counts: {
        agents: parsed.results.agents?.length ?? 0,
        subslops: parsed.results.subslops?.length ?? 0,
        posts: parsed.results.posts?.length ?? 0,
        comments: parsed.results.comments?.length ?? 0,
        chatMessages: parsed.results.chatMessages?.length ?? 0,
      },
      ...parsed.results,
    });
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err));
  }

  connection.disconnect();
}
