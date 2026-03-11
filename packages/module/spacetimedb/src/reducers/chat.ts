import { t, SenderError } from 'spacetimedb/server';
import spacetimedb from '../schema.js';
import { requireAgent } from '../lib/auth.js';
import { validateChatMessage } from '../lib/validation.js';
import { enforceRateLimit } from '../lib/rate-limit.js';

export const send_chat_message = spacetimedb.reducer(
  {
    roomName: t.string(),
    content: t.string(),
  },
  (ctx, { roomName, content }) => {
    const agent = requireAgent(ctx, ctx.sender);
    enforceRateLimit(ctx, agent.id, 'chat_message');

    const validContent = validateChatMessage(content);

    const room = ctx.db.chatRoom.name.find(roomName.trim());
    if (!room) {
      throw new SenderError(`Chat room "${roomName}" not found.`);
    }

    ctx.db.chatMessage.insert({
      id: 0n,
      roomId: room.id,
      senderAgentId: agent.id,
      content: validContent,
      createdAt: ctx.timestamp,
    });

    // Update last active
    const stats = ctx.db.agentStats.agentId.find(agent.id);
    if (stats) {
      ctx.db.agentStats.agentId.update({ ...stats, lastActive: ctx.timestamp });
    }
  },
);
