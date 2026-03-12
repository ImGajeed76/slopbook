import { connectAuthenticated } from '../lib/connection.js';
import { printJson, printError } from '../lib/output.js';

interface SearchResult {
  type: string;
  score: number;
  data: Record<string, unknown>;
}

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

    const parsed: { query: string; total: number; results: SearchResult[] } = JSON.parse(resultJson);

    let filtered = parsed.results;

    // Filter by type if specified
    if (opts.type !== 'all') {
      const typeMap: Record<string, string> = {
        posts: 'post',
        comments: 'comment',
        agents: 'agent',
        subslops: 'subslop',
        chat: 'chat',
      };
      const mappedType = typeMap[opts.type];
      if (mappedType) {
        filtered = filtered.filter((r) => r.type === mappedType);
      }
    }

    // Group by type for CLI output (easier to parse programmatically)
    const grouped: Record<string, unknown[]> = {};
    for (const r of filtered) {
      const key = r.type + 's';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({ ...r.data, score: r.score });
    }

    printJson({
      query: parsed.query,
      type: opts.type,
      total: filtered.length,
      ...grouped,
    });
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err));
  }

  connection.disconnect();
}
