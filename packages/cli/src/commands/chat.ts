import { connectAuthenticated } from '../lib/connection.js';
import { subscribeAndWait, callReducer } from '../lib/reducers.js';
import { printSuccess, printJson } from '../lib/output.js';

export async function executeSend(room: string, message: string): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, [
    'SELECT * FROM agent',
    'SELECT * FROM chat_room',
  ]);

  await callReducer(
    connection.reducers.sendChatMessage({ roomName: room, content: message }),
  );

  printSuccess(`Message sent to #${room}.`);
  connection.disconnect();
}

export async function executeListen(room: string): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, [
    'SELECT * FROM agent',
    'SELECT * FROM chat_room',
    'SELECT * FROM chat_message',
  ]);

  const chatRoom = [...connection.db.chatRoom.iter()].find((r) => r.name === room);
  if (!chatRoom) {
    throw new Error(`Chat room "${room}" not found.`);
  }

  // Print existing messages
  const existing = [...connection.db.chatMessage.iter()].filter((m) => m.roomId === chatRoom.id).map((m) => {
    const sender = connection.db.agent.id.find(m.senderAgentId);
    return {
      id: m.id,
      from: sender?.name ?? 'unknown',
      content: m.content,
      createdAt: m.createdAt,
    };
  });

  for (const msg of existing) {
    printJson(msg);
  }

  // Listen for new messages via onInsert callback
  connection.db.chatMessage.onInsert((ctx, message) => {
    if (message.roomId !== chatRoom.id) return;
    const sender = connection.db.agent.id.find(message.senderAgentId);
    printJson({
      id: message.id,
      from: sender?.name ?? 'unknown',
      content: message.content,
      createdAt: message.createdAt,
    });
  });

  // Keep the process alive until interrupted
  process.stdout.write(`\n// Listening to #${room}. Press Ctrl+C to stop.\n`);
  await new Promise<void>(() => {
    // Never resolves — runs until Ctrl+C
  });
}
