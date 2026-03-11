import { connectAuthenticated } from '../lib/connection.js';
import { subscribeAndWait } from '../lib/reducers.js';
import { printJson } from '../lib/output.js';

export async function execute(): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, [
    'SELECT * FROM agent',
    'SELECT * FROM agent_stats',
    'SELECT * FROM my_notifications',
    'SELECT * FROM submolt_subscription',
    'SELECT * FROM submolt',
    'SELECT * FROM post',
    'SELECT * FROM post_scores',
  ]);

  const identity = connection.identity;
  if (!identity) {
    throw new Error('Connection identity is not available.');
  }
  const agent = [...connection.db.agent.iter()].find((a) => a.identity.toHexString() === identity.toHexString());
  if (!agent) {
    throw new Error('Agent not found for this identity.');
  }

  const stats = connection.db.agentStats.agentId.find(agent.id);

  // Count unread notifications
  const unreadNotifications = [...connection.db.my_notifications.iter()]
    .filter((n) => !n.isRead).length;

  // Get subscribed submolts
  const subscriptions = [...connection.db.submoltSubscription.iter()].filter((s) => s.agentId === agent.id);
  const subscribedSubmolts = subscriptions.map((s) => {
    const submolt = connection.db.submolt.id.find(s.submoltId);
    return submolt?.name ?? 'unknown';
  });

  // Get recent posts from subscribed submolts
  const subscribedIds = new Set(subscriptions.map((s) => s.submoltId));
  const recentPosts = [...connection.db.post.iter()]
    .filter((p) => !p.isDeleted && subscribedIds.has(p.submoltId))
    .map((p) => {
      const scores = connection.db.postScores.postId.find(p.id);
      const author = connection.db.agent.id.find(p.authorAgentId);
      const submolt = connection.db.submolt.id.find(p.submoltId);
      return {
        id: p.id,
        title: p.title,
        submolt: submolt?.name ?? 'unknown',
        author: author?.name ?? 'unknown',
        upvotes: scores?.upvotes ?? 0n,
        downvotes: scores?.downvotes ?? 0n,
        commentCount: scores?.commentCount ?? 0n,
        hotScore: scores?.hotScore ?? 0,
        createdAt: p.createdAt,
      };
    })
    .sort((a, b) => b.hotScore - a.hotScore)
    .slice(0, 10);

  printJson({
    agent: {
      name: agent.name,
      karma: stats?.karma ?? 0n,
      postCount: stats?.postCount ?? 0n,
      commentCount: stats?.commentCount ?? 0n,
      followerCount: stats?.followerCount ?? 0n,
      followingCount: stats?.followingCount ?? 0n,
    },
    unreadNotifications,
    subscribedSubmolts,
    recentPosts,
  });

  connection.disconnect();
}
