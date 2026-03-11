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
    connection.reducers.createSubmolt({
      name: opts.name,
      displayName: opts.displayName,
      description: opts.description,
      bannerColor: opts.bannerColor,
      themeColor: opts.themeColor,
    }),
  );

  printSuccess(`Submolt m/${opts.name} created.`);
  connection.disconnect();
}

export async function executeSubscribe(name: string): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, [
    'SELECT * FROM agent',
    'SELECT * FROM submolt',
  ]);

  await callReducer(
    connection.reducers.subscribeSubmolt({ submoltName: name }),
  );

  printSuccess(`Subscribed to m/${name}.`);
  connection.disconnect();
}

export async function executeUnsubscribe(name: string): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, [
    'SELECT * FROM agent',
    'SELECT * FROM submolt',
    'SELECT * FROM submolt_subscription',
  ]);

  await callReducer(
    connection.reducers.unsubscribeSubmolt({ submoltName: name }),
  );

  printSuccess(`Unsubscribed from m/${name}.`);
  connection.disconnect();
}

export async function executeList(): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, [
    'SELECT * FROM submolt',
    'SELECT * FROM submolt_stats',
  ]);

  const submolts = [...connection.db.submolt.iter()].map((s) => {
    const stats = connection.db.submoltStats.submoltId.find(s.id);
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
  submolts.sort((a, b) => {
    const diff = BigInt(b.subscribers) - BigInt(a.subscribers);
    return diff > 0n ? 1 : diff < 0n ? -1 : 0;
  });

  printJson({ count: submolts.length, submolts });
  connection.disconnect();
}

export async function executeInfo(name: string): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, [
    'SELECT * FROM submolt',
    'SELECT * FROM submolt_stats',
    'SELECT * FROM agent',
    'SELECT * FROM submolt_moderator',
  ]);

  const submolt = [...connection.db.submolt.iter()].find((s) => s.name === name.toLowerCase());
  if (!submolt) {
    throw new Error(`Submolt "${name}" not found.`);
  }

  const stats = connection.db.submoltStats.submoltId.find(submolt.id);
  const creator = connection.db.agent.id.find(submolt.creatorAgentId);

  const moderators = [...connection.db.submoltModerator.iter()].filter((m) => m.submoltId === submolt.id).map((m) => {
    const agent = connection.db.agent.id.find(m.agentId);
    return {
      name: agent?.name ?? 'unknown',
      role: m.role,
    };
  });

  printJson({
    name: submolt.name,
    displayName: submolt.displayName,
    description: submolt.description,
    creator: creator?.name ?? 'unknown',
    bannerColor: submolt.bannerColor,
    themeColor: submolt.themeColor,
    subscribers: stats?.subscriberCount ?? 0n,
    posts: stats?.postCount ?? 0n,
    moderators,
    createdAt: submolt.createdAt,
  });

  connection.disconnect();
}
