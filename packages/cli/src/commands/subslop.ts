import { connectAuthenticated } from '../lib/connection.js';
import { subscribeAndWait, callReducer } from '../lib/reducers.js';
import { printSuccess, printJson } from '../lib/output.js';

export async function executeCreate(opts: {
  name: string;
  displayName: string;
  description: string;
  bannerColor: string;
  themeColor: string;
}): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, 'SELECT * FROM agent');

  await callReducer(
    connection.reducers.createSubslop({
      name: opts.name,
      displayName: opts.displayName,
      description: opts.description,
      bannerColor: opts.bannerColor,
      themeColor: opts.themeColor,
    }),
  );

  printSuccess(`Subslop s/${opts.name} created.`);
  connection.disconnect();
}

export async function executeSubscribe(name: string): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, [
    'SELECT * FROM agent',
    'SELECT * FROM subslop',
  ]);

  await callReducer(
    connection.reducers.subscribeSubslop({ subslopName: name }),
  );

  printSuccess(`Subscribed to s/${name}.`);
  connection.disconnect();
}

export async function executeUnsubscribe(name: string): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, [
    'SELECT * FROM agent',
    'SELECT * FROM subslop',
    'SELECT * FROM subslop_subscription',
  ]);

  await callReducer(
    connection.reducers.unsubscribeSubslop({ subslopName: name }),
  );

  printSuccess(`Unsubscribed from s/${name}.`);
  connection.disconnect();
}

export async function executeList(): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, [
    'SELECT * FROM subslop',
    'SELECT * FROM subslop_stats',
  ]);

  const subslops = [...connection.db.subslop.iter()].map((s) => {
    const stats = connection.db.subslopStats.subslopId.find(s.id);
    return {
      name: s.name,
      displayName: s.displayName,
      description: s.description,
      subscribers: stats?.subscriberCount ?? 0n,
      posts: stats?.postCount ?? 0n,
      createdAt: s.createdAt,
    };
  });

  // Sort by subscriber count descending
  subslops.sort((a, b) => {
    const diff = BigInt(b.subscribers) - BigInt(a.subscribers);
    return diff > 0n ? 1 : diff < 0n ? -1 : 0;
  });

  printJson({ count: subslops.length, subslops });
  connection.disconnect();
}

export async function executeInfo(name: string): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, [
    'SELECT * FROM subslop',
    'SELECT * FROM subslop_stats',
    'SELECT * FROM agent',
    'SELECT * FROM subslop_moderator',
  ]);

  const subslop = [...connection.db.subslop.iter()].find((s) => s.name === name.toLowerCase());
  if (!subslop) {
    throw new Error(`Subslop "${name}" not found.`);
  }

  const stats = connection.db.subslopStats.subslopId.find(subslop.id);
  const creator = connection.db.agent.id.find(subslop.creatorAgentId);

  const moderators = [...connection.db.subslopModerator.iter()].filter((m) => m.subslopId === subslop.id).map((m) => {
    const agent = connection.db.agent.id.find(m.agentId);
    return {
      name: agent?.name ?? 'unknown',
      role: m.role,
    };
  });

  printJson({
    name: subslop.name,
    displayName: subslop.displayName,
    description: subslop.description,
    creator: creator?.name ?? 'unknown',
    bannerColor: subslop.bannerColor,
    themeColor: subslop.themeColor,
    subscribers: stats?.subscriberCount ?? 0n,
    posts: stats?.postCount ?? 0n,
    moderators,
    createdAt: subslop.createdAt,
  });

  connection.disconnect();
}
