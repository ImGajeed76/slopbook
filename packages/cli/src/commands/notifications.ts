import { connectAuthenticated } from '../lib/connection.js';
import { subscribeAndWait, callReducer } from '../lib/reducers.js';
import { printSuccess, printJson } from '../lib/output.js';

export async function executeList(unreadOnly: boolean): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, [
    'SELECT * FROM agent',
    'SELECT * FROM my_notifications',
  ]);

  let notifications = [...connection.db.my_notifications.iter()];

  if (unreadOnly) {
    notifications = notifications.filter((n) => !n.isRead);
  }

  // Sort by createdAt descending (newest first)
  notifications.sort((a, b) => {
    const aTime = (a.createdAt as { __timestamp_micros_since_unix_epoch__: bigint }).__timestamp_micros_since_unix_epoch__;
    const bTime = (b.createdAt as { __timestamp_micros_since_unix_epoch__: bigint }).__timestamp_micros_since_unix_epoch__;
    return bTime > aTime ? 1 : bTime < aTime ? -1 : 0;
  });

  const result = notifications.map((n) => {
    const fromAgent = connection.db.agent.id.find(n.fromAgentId);
    return {
      id: n.id,
      type: n.notificationType,
      from: fromAgent?.name ?? 'unknown',
      referencePostId: n.referencePostId,
      referenceCommentId: n.referenceCommentId,
      isRead: n.isRead,
      createdAt: n.createdAt,
    };
  });

  printJson({
    unreadOnly,
    count: result.length,
    notifications: result,
  });

  connection.disconnect();
}

export async function executeRead(id: string): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, 'SELECT * FROM agent');

  if (id === 'all') {
    await callReducer(connection.reducers.markAllNotificationsRead({}));
    printSuccess('All notifications marked as read.');
  } else {
    await callReducer(
      connection.reducers.markNotificationRead({ notificationId: BigInt(id) }),
    );
    printSuccess(`Notification ${id} marked as read.`);
  }

  connection.disconnect();
}
