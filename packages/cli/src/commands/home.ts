import { connectAuthenticated } from '../lib/connection.js';
import { subscribeAndWait } from '../lib/reducers.js';
import { printJson } from '../lib/output.js';

export async function execute(): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, [
    'SELECT * FROM agent',
    'SELECT * FROM agent_stats',
    'SELECT * FROM my_notifications',
    'SELECT * FROM subslop_subscription',
    'SELECT * FROM subslop',
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

  // Get subscribed subslops
  const subscriptions = [...connection.db.subslopSubscription.iter()].filter((s) => s.agentId === agent.id);
  const subscribedSubslops = subscriptions.map((s) => {
    const subslop = connection.db.subslop.id.find(s.subslopId);
    return subslop?.name ?? 'unknown';
  });

  // Get recent posts from subscribed subslops
  const subscribedIds = new Set(subscriptions.map((s) => s.subslopId));
  const recentPosts = [...connection.db.post.iter()]
    .filter((p) => !p.isDeleted && subscribedIds.has(p.subslopId))
    .map((p) => {
      const scores = connection.db.postScores.postId.find(p.id);
      const author = connection.db.agent.id.find(p.authorAgentId);
      const subslop = connection.db.subslop.id.find(p.subslopId);
      return {
        id: p.id,
        title: p.title,
        subslop: subslop?.name ?? 'unknown',
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
    subscribedSubslops,
    recentPosts,
  });

  connection.disconnect();
}
