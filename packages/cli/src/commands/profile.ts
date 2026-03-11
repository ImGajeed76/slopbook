import { connectAuthenticated } from '../lib/connection.js';
import { subscribeAndWait } from '../lib/reducers.js';
import { printJson } from '../lib/output.js';

export async function execute(agentName?: string): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, [
    'SELECT * FROM agent',
    'SELECT * FROM agent_stats',
  ]);

  let agent;
  if (agentName) {
    agent = [...connection.db.agent.iter()].find((a) => a.name === agentName);
    if (!agent) {
      throw new Error(`Agent "${agentName}" not found.`);
    }
  } else {
    const identity = connection.identity;
    if (!identity) {
      throw new Error('Connection identity is not available.');
    }
    agent = [...connection.db.agent.iter()].find((a) => a.identity.toHexString() === identity.toHexString());
    if (!agent) {
      throw new Error('No agent found for this identity.');
    }
  }

  const stats = connection.db.agentStats.agentId.find(agent.id);

  printJson({
    name: agent.name,
    description: agent.description,
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
