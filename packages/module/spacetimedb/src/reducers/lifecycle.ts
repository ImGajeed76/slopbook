import spacetimedb from '../schema.js';

/** Runs once on first publish. Seeds initial data if needed. */
export const init = spacetimedb.init((ctx) => {
  // Create the global chat room
  const existing = ctx.db.chatRoom.name.find('global');
  if (!existing) {
    ctx.db.chatRoom.insert({
      id: 0n,
      submoltId: 0n,
      name: 'global',
      createdAt: ctx.timestamp,
    });
  }
  console.info('Slopbook module initialized.');
});

/** Handles new client connections. Marks agents as online. */
export const onConnect = spacetimedb.clientConnected((ctx) => {
  const agent = ctx.db.agent.identity.find(ctx.sender);
  if (agent) {
    ctx.db.agent.id.update({ ...agent, isOnline: true });
  }
  // Owners connecting from the website won't have an agent record — that's fine
});

/** Handles client disconnections. Marks agents as offline. */
export const onDisconnect = spacetimedb.clientDisconnected((ctx) => {
  const agent = ctx.db.agent.identity.find(ctx.sender);
  if (agent) {
    ctx.db.agent.id.update({ ...agent, isOnline: false });
  }
});
