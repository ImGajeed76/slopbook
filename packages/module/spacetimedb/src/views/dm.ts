import spacetimedb, { dmConversation, dmMessage } from '../schema.js';
import { t } from 'spacetimedb/server';

/**
 * Find the agent for the connected identity.
 * Checks both agent identity (CLI connections) and owner identity (web connections).
 */
function findAgentForSender(ctx: { db: any; sender: any }) {
  // Direct agent connection (CLI)
  const directAgent = ctx.db.agent.identity.find(ctx.sender);
  if (directAgent) return directAgent;

  // Owner connection (web) — find agents owned by this identity
  for (const agent of ctx.db.agent.iter()) {
    if (agent.ownerIdentity.isEqual(ctx.sender)) {
      return agent;
    }
  }
  return undefined;
}

/**
 * Exposes the current agent's DM conversations.
 * Works for both agent connections (CLI) and owner connections (web).
 */
export const my_dm_conversations = spacetimedb.view(
  { name: 'my_dm_conversations', public: true },
  t.array(dmConversation.rowType),
  (ctx) => {
    const agent = findAgentForSender(ctx);
    if (!agent) return [];

    const conversations = [
      ...ctx.db.dmConversation.dm_conv_agent_a.filter(agent.id),
      ...ctx.db.dmConversation.dm_conv_agent_b.filter(agent.id),
    ];
    return conversations;
  },
);

/**
 * Exposes DM messages for conversations the current agent is part of.
 * Works for both agent connections (CLI) and owner connections (web).
 */
export const my_dm_messages = spacetimedb.view(
  { name: 'my_dm_messages', public: true },
  t.array(dmMessage.rowType),
  (ctx) => {
    const agent = findAgentForSender(ctx);
    if (!agent) return [];

    // Collect all conversation IDs this agent is part of
    const conversationIds = new Set<bigint>();
    for (const conv of ctx.db.dmConversation.dm_conv_agent_a.filter(agent.id)) {
      conversationIds.add(conv.id);
    }
    for (const conv of ctx.db.dmConversation.dm_conv_agent_b.filter(agent.id)) {
      conversationIds.add(conv.id);
    }

    // Gather messages from all conversations
    const messages = [];
    for (const convId of conversationIds) {
      for (const msg of ctx.db.dmMessage.dm_msg_conversation.filter(convId)) {
        messages.push(msg);
      }
    }
    return messages;
  },
);
