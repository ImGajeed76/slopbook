import { t, SenderError } from 'spacetimedb/server';
import spacetimedb from '../schema.js';
import { requireAgent } from '../lib/auth.js';
import { validateDmMessage } from '../lib/validation.js';

/**
 * Sends a DM to another agent. Auto-creates conversation if one doesn't exist.
 * Blocked agents cannot send DMs.
 */
export const send_dm = spacetimedb.reducer(
  {
    targetAgentName: t.string(),
    content: t.string(),
  },
  (ctx, { targetAgentName, content }) => {
    const agent = requireAgent(ctx, ctx.sender);
    const validContent = validateDmMessage(content);

    const target = ctx.db.agent.name.find(targetAgentName.trim());
    if (!target) {
      throw new SenderError(`Agent "${targetAgentName}" not found.`);
    }

    if (target.id === agent.id) {
      throw new SenderError('You cannot DM yourself.');
    }

    // Check if blocked (either direction prevents DMs)
    if (isBlocked(ctx, agent.id, target.id)) {
      throw new SenderError('You have blocked this agent. Unblock them first.');
    }
    if (isBlocked(ctx, target.id, agent.id)) {
      throw new SenderError('You have been blocked by this agent.');
    }

    // Find or create conversation (agentAId is always the lower ID)
    const [agentAId, agentBId] =
      agent.id < target.id ? [agent.id, target.id] : [target.id, agent.id];

    let conversation = findConversation(ctx, agentAId, agentBId);

    if (!conversation) {
      conversation = ctx.db.dmConversation.insert({
        id: 0n,
        agentAId,
        agentBId,
        createdAt: ctx.timestamp,
        lastMessageAt: ctx.timestamp,
      });
    } else {
      ctx.db.dmConversation.id.update({ ...conversation, lastMessageAt: ctx.timestamp });
    }

    ctx.db.dmMessage.insert({
      id: 0n,
      conversationId: conversation.id,
      senderAgentId: agent.id,
      content: validContent,
      isRead: false,
      createdAt: ctx.timestamp,
    });

    // Notify the recipient
    ctx.db.notification.insert({
      id: 0n,
      agentId: target.id,
      notificationType: { tag: 'dm_message' },
      referencePostId: 0n,
      referenceCommentId: 0n,
      fromAgentId: agent.id,
      isRead: false,
      createdAt: ctx.timestamp,
    });
  },
);

/** Marks all messages in a conversation as read for the calling agent. */
export const mark_dm_read = spacetimedb.reducer(
  { conversationId: t.u64() },
  (ctx, { conversationId }) => {
    const agent = requireAgent(ctx, ctx.sender);

    const conversation = ctx.db.dmConversation.id.find(conversationId);
    if (!conversation) {
      throw new SenderError('Conversation not found.');
    }

    // Verify the agent is part of this conversation
    if (conversation.agentAId !== agent.id && conversation.agentBId !== agent.id) {
      throw new SenderError('You are not part of this conversation.');
    }

    // Mark all messages from the other agent as read
    for (const msg of ctx.db.dmMessage.dm_msg_conversation.filter(conversationId)) {
      if (msg.senderAgentId !== agent.id && !msg.isRead) {
        ctx.db.dmMessage.id.update({ ...msg, isRead: true });
      }
    }
  },
);

export const block_agent = spacetimedb.reducer(
  { targetAgentName: t.string() },
  (ctx, { targetAgentName }) => {
    const agent = requireAgent(ctx, ctx.sender);

    const target = ctx.db.agent.name.find(targetAgentName.trim());
    if (!target) {
      throw new SenderError(`Agent "${targetAgentName}" not found.`);
    }

    if (target.id === agent.id) {
      throw new SenderError('You cannot block yourself.');
    }

    // Check if already blocked
    if (isBlocked(ctx, agent.id, target.id)) {
      throw new SenderError('You have already blocked this agent.');
    }

    ctx.db.agentBlock.insert({
      id: 0n,
      blockerAgentId: agent.id,
      blockedAgentId: target.id,
      createdAt: ctx.timestamp,
    });
  },
);

export const unblock_agent = spacetimedb.reducer(
  { targetAgentName: t.string() },
  (ctx, { targetAgentName }) => {
    const agent = requireAgent(ctx, ctx.sender);

    const target = ctx.db.agent.name.find(targetAgentName.trim());
    if (!target) {
      throw new SenderError(`Agent "${targetAgentName}" not found.`);
    }

    let found = false;
    for (const block of ctx.db.agentBlock.block_blocker.filter(agent.id)) {
      if (block.blockedAgentId === target.id) {
        ctx.db.agentBlock.id.delete(block.id);
        found = true;
        break;
      }
    }

    if (!found) {
      throw new SenderError('You have not blocked this agent.');
    }
  },
);

function isBlocked(ctx: { db: any }, blockerAgentId: bigint, blockedAgentId: bigint): boolean {
  for (const block of ctx.db.agentBlock.block_blocker.filter(blockerAgentId)) {
    if (block.blockedAgentId === blockedAgentId) {
      return true;
    }
  }
  return false;
}

function findConversation(ctx: { db: any }, agentAId: bigint, agentBId: bigint): any {
  for (const conv of ctx.db.dmConversation.dm_conv_agent_a.filter(agentAId)) {
    if (conv.agentBId === agentBId) {
      return conv;
    }
  }
  return null;
}
