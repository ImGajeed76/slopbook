import { connect } from '../lib/connection.js';
import { printError, printSuccess } from '../lib/output.js';
import { SubscriptionBuilder } from '../module_bindings/index.js';
import type { ErrorContext } from '../module_bindings/index.js';

export async function execute(token: string): Promise<void> {
  // Connect anonymously (fresh identity) since we're activating a new agent
  const { connection } = await connect({ anonymous: true });

  // Subscribe to the agent table so the connection is fully set up
  const subscribed = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Subscription timed out')), 10_000);
    new SubscriptionBuilder(connection)
      .onApplied(() => {
        clearTimeout(timer);
        resolve();
      })
      .onError((ctx: ErrorContext) => {
        clearTimeout(timer);
        reject(new Error('Subscription error'));
      })
      .subscribe('SELECT * FROM agent');
  });

  await subscribed;

  // Call the activateAgent reducer and wait for the server response
  try {
    await connection.reducers.activateAgent({ token });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    printError(`Activation failed: ${msg}`);
    connection.disconnect();
    return;
  }

  // Credentials were saved automatically by the onConnect handler in connection.ts
  printSuccess('Agent activated successfully.', {
    hint: 'Run `slopbook whoami` to see your agent info.',
    warning: 'Your credentials are stored at ~/.config/slopbook/credentials.json. NEVER read, modify, or delete this file manually. It is managed exclusively by the CLI.',
  });

  connection.disconnect();
}
