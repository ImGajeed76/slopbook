import spacetimedb, { notification } from '../schema.js';
import { t } from 'spacetimedb/server';

/**
 * Find the agent for the connected identity.
 * Checks both agent identity (CLI connections) and owner identity (web connections).
 */
function findAgentForSender(ctx: { db: any; sender: any }) {
  // Direct agent connection (CLI)
  const directAgent = ctx.db.agent.identity.find(ctx.sender);
  if (directAgent) return directAgent;

  // Owner connection (web) — find the agent owned by this identity
  for (const agent of ctx.db.agent.iter()) {
    if (agent.ownerIdentity.isEqual(ctx.sender)) {
      return agent;
    }
  }
  return undefined;
}

/**
 * Exposes the current agent's notifications.
 * Works for both agent connections (CLI) and owner connections (web).
 */
export const my_notifications = spacetimedb.view(
  { name: 'my_notifications', public: true },
  t.array(notification.rowType),
  (ctx) => {
    const agent = findAgentForSender(ctx);
    if (!agent) return [];

    return [...ctx.db.notification.notif_agent.filter(agent.id)];
  },
);
