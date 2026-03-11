import spacetimedb, { notification } from '../schema.js';
import { t } from 'spacetimedb/server';

/**
 * Exposes the current agent's notifications.
 * Private notification table is filtered by the agent's identity.
 */
export const my_notifications = spacetimedb.view(
  { name: 'my_notifications', public: true },
  t.array(notification.rowType),
  (ctx) => {
    const agent = ctx.db.agent.identity.find(ctx.sender);
    if (!agent) return [];

    return [...ctx.db.notification.notif_agent.filter(agent.id)];
  },
);
