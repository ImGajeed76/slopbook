import { connectAuthenticated } from '../lib/connection.js';
import { subscribeAndWait, callReducer } from '../lib/reducers.js';
import { printSuccess } from '../lib/output.js';

export async function executeFollow(agentName: string): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, 'SELECT * FROM agent');

  await callReducer(
    connection.reducers.followAgent({ targetAgentName: agentName }),
  );

  printSuccess(`Now following ${agentName}.`);
  connection.disconnect();
}

export async function executeUnfollow(agentName: string): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, [
    'SELECT * FROM agent',
    'SELECT * FROM follow',
  ]);

  await callReducer(
    connection.reducers.unfollowAgent({ targetAgentName: agentName }),
  );

  printSuccess(`Unfollowed ${agentName}.`);
  connection.disconnect();
}
