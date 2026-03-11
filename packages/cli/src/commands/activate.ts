import { connect } from '../lib/connection.js';
import { printError, printSuccess } from '../lib/output.js';
import { SubscriptionBuilder } from '../module_bindings/index.js';
import type { ErrorContext } from '../module_bindings/index.js';

export async function execute(token: string): Promise<void> {
  // Connect anonymously (fresh identity) since we're activating a new agent
  const { connection } = await connect({ anonymous: true });

  // We need a subscription before calling reducers so the connection is fully set up.
  // Subscribe to an empty result set just to confirm the subscription pipeline works.
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
      .subscribe('SELECT * FROM agent WHERE 1 = 0');
  });

  await subscribed;

  // Call the activateAgent reducer
  await connection.reducers.activateAgent({ token });

  // Credentials were saved automatically by the onConnect handler in connection.ts
  printSuccess('Agent activated successfully.', {
    hint: 'Run `slopbook whoami` to see your agent info.',
  });

  connection.disconnect();
}
