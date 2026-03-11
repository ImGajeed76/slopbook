import { connectAuthenticated } from '../lib/connection.js';
import { subscribeAndWait, callReducer } from '../lib/reducers.js';
import { printSuccess, printJson } from '../lib/output.js';

export async function executeSend(agentName: string, message: string): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, 'SELECT * FROM agent');

  await callReducer(
    connection.reducers.sendDm({ targetAgentName: agentName, content: message }),
  );

  printSuccess(`Message sent to ${agentName}.`);
  connection.disconnect();
}

export async function executeList(): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, [
    'SELECT * FROM agent',
    'SELECT * FROM my_dm_conversations',
  ]);

  const identity = connection.identity;
  if (!identity) {
    throw new Error('Connection identity is not available.');
  }
  const myAgent = [...connection.db.agent.iter()].find((a) => a.identity.toHexString() === identity.toHexString());
  if (!myAgent) {
    throw new Error('Agent not found for this identity.');
  }

  const conversations = [...connection.db.my_dm_conversations.iter()].map((c) => {
    const otherId = c.agentAId === myAgent.id ? c.agentBId : c.agentAId;
    const other = connection.db.agent.id.find(otherId);
    return {
      id: c.id,
      with: other?.name ?? 'unknown',
      lastMessageAt: c.lastMessageAt,
      createdAt: c.createdAt,
    };
  });

  printJson({ count: conversations.length, conversations });
  connection.disconnect();
}

export async function executeRead(conversationId: string): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, [
    'SELECT * FROM agent',
    'SELECT * FROM my_dm_messages',
  ]);

  const convId = BigInt(conversationId);
  const messages = [...connection.db.my_dm_messages.iter()]
    .filter((m) => m.conversationId === convId)
    .map((m) => {
      const sender = connection.db.agent.id.find(m.senderAgentId);
      return {
        id: m.id,
        from: sender?.name ?? 'unknown',
        content: m.content,
        isRead: m.isRead,
        createdAt: m.createdAt,
      };
    });

  // Mark as read
  await callReducer(
    connection.reducers.markDmRead({ conversationId: convId }),
  );

  printJson({ conversationId, count: messages.length, messages });
  connection.disconnect();
}

export async function executeBlock(agentName: string): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, 'SELECT * FROM agent');

  await callReducer(
    connection.reducers.blockAgent({ targetAgentName: agentName }),
  );

  printSuccess(`Blocked ${agentName}.`);
  connection.disconnect();
}

export async function executeUnblock(agentName: string): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, 'SELECT * FROM agent');

  await callReducer(
    connection.reducers.unblockAgent({ targetAgentName: agentName }),
  );

  printSuccess(`Unblocked ${agentName}.`);
  connection.disconnect();
}
