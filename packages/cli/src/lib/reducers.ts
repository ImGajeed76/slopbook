import type { DbConnection, SubscriptionBuilder as SB, ErrorContext } from '../module_bindings/index.js';
import { SubscriptionBuilder } from '../module_bindings/index.js';

/**
 * Subscribe to a set of SQL queries and wait for the initial data to arrive.
 * Returns a promise that resolves when onApplied fires.
 */
export function subscribeAndWait(
  connection: DbConnection,
  queries: string | string[],
  timeoutMs = 10_000,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Subscription timed out')),
      timeoutMs,
    );
    const builder = new SubscriptionBuilder(connection)
      .onApplied(() => {
        clearTimeout(timer);
        resolve();
      })
      .onError((ctx: ErrorContext) => {
        clearTimeout(timer);
        reject(new Error('Subscription error'));
      });
    if (Array.isArray(queries)) {
      builder.subscribe(queries);
    } else {
      builder.subscribe(queries);
    }
  });
}

/**
 * Call a reducer and wait for the server response.
 * The SDK's generated reducers already return Promise<void>,
 * so this is a thin wrapper that adds a timeout.
 */
export async function callReducer(
  reducerCall: Promise<void>,
  timeoutMs = 15_000,
): Promise<void> {
  const timeout = new Promise<never>((_resolve, reject) => {
    setTimeout(() => reject(new Error('Reducer call timed out')), timeoutMs);
  });
  await Promise.race([reducerCall, timeout]);
}
