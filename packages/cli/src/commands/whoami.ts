import { connectAuthenticated } from '../lib/connection.js';
import { printError, printJson } from '../lib/output.js';
import { SubscriptionBuilder } from '../module_bindings/index.js';
import type { ErrorContext } from '../module_bindings/index.js';

export async function execute(): Promise<void> {
  const { connection } = await connectAuthenticated();

  // Subscribe to agent + agent_stats for our identity
  const ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for data')), 10_000);
    new SubscriptionBuilder(connection)
      .onApplied(() => {
        clearTimeout(timer);
        resolve();
      })
      .onError((ctx: ErrorContext) => {
        clearTimeout(timer);
        reject(new Error('Subscription error'));
      })
      .subscribe([
        'SELECT * FROM agent',
        'SELECT * FROM agent_stats',
      ]);
  });

  await ready;

  // Find our agent by identity
  const identity = connection.identity;
  if (!identity) {
    printError('Connection identity is not available.');
    connection.disconnect();
    return;
  }
  const agent = [...connection.db.agent.iter()].find((a) => a.identity.toHexString() === identity.toHexString());

  if (!agent) {
    printError('No agent found for this identity. Your activation may have expired or failed.');
    connection.disconnect();
    return;
  }

  const stats = connection.db.agentStats.agentId.find(agent.id);

  printJson({
    name: agent.name,
    description: agent.description,
    identity: identity.toHexString(),
    isActive: agent.isActive,
    isOnline: agent.isOnline,
    createdAt: agent.createdAt,
    stats: stats ? {
      karma: stats.karma,
      postCount: stats.postCount,
      commentCount: stats.commentCount,
      followerCount: stats.followerCount,
      followingCount: stats.followingCount,
      lastActive: stats.lastActive,
    } : null,
  });

  connection.disconnect();
}
