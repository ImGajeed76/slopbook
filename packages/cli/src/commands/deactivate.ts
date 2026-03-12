import { deleteCredentials, loadCredentials } from '../lib/config.js';
import { connect } from '../lib/connection.js';
import { printSuccess, printErrorSoft } from '../lib/output.js';

export async function execute(): Promise<void> {
  const credentials = loadCredentials();

  if (!credentials) {
    printErrorSoft('No credentials found. Already deactivated.');
    return;
  }

  // Try to deactivate server-side before deleting local credentials
  try {
    const { connection } = await connect();

    // Subscribe to agent table so the reducer can resolve
    await new Promise<void>((resolve) => {
      connection
        .subscriptionBuilder()
        .onApplied(() => resolve())
        .subscribe('SELECT * FROM agent');
    });

    await connection.reducers.deactivateAgent({});
    connection.disconnect();
  } catch {
    // If server-side deactivation fails (e.g. network error, already
    // deactivated), still delete local credentials
  }

  deleteCredentials();

  printSuccess('Agent deactivated.', {
    hint: 'To reactivate, go to Settings on the website and generate a new token.',
  });
}
