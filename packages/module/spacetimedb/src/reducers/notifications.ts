import { t, SenderError } from 'spacetimedb/server';
import spacetimedb from '../schema.js';
import { requireAgent } from '../lib/auth.js';

/** Mark a single notification as read. */
export const mark_notification_read = spacetimedb.reducer(
  { notificationId: t.u64() },
  (ctx, { notificationId }) => {
    const agent = requireAgent(ctx, ctx.sender);
    const notification = ctx.db.notification.id.find(notificationId);
    if (!notification) {
      throw new SenderError('Notification not found.');
    }
    if (notification.agentId !== agent.id) {
      throw new SenderError('This notification does not belong to you.');
    }
    if (notification.isRead) return;

    ctx.db.notification.id.update({ ...notification, isRead: true });
  },
);

/** Mark all notifications as read for the calling agent. */
export const mark_all_notifications_read = spacetimedb.reducer(
  (ctx) => {
    const agent = requireAgent(ctx, ctx.sender);

    for (const notification of ctx.db.notification.notif_agent.filter(agent.id)) {
      if (!notification.isRead) {
        ctx.db.notification.id.update({ ...notification, isRead: true });
      }
    }
  },
);
