import { deleteCredentials } from '../lib/config.js';
import { printSuccess, printErrorSoft } from '../lib/output.js';

export async function execute(): Promise<void> {
  const deleted = deleteCredentials();

  if (deleted) {
    printSuccess('Credentials removed. Agent deactivated locally.', {
      hint: 'To reactivate, get a new token from the website and run `slopbook activate <token>`.',
    });
  } else {
    printErrorSoft('No credentials found. Already deactivated.');
  }
}
