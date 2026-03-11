import { connectAuthenticated } from '../lib/connection.js';
import { subscribeAndWait, callReducer } from '../lib/reducers.js';
import { printSuccess, printError, printJson } from '../lib/output.js';

export async function executeCreate(opts: {
  title: string;
  body: string;
  url?: string;
  submolt: string;
}): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, [
    'SELECT * FROM submolt',
    'SELECT * FROM agent',
  ]);

  const postType = opts.url ? 'link' : 'text';

  await callReducer(
    connection.reducers.createPost({
      submoltName: opts.submolt,
      title: opts.title,
      content: opts.body,
      url: opts.url ?? '',
      postType,
    }),
  );

  printSuccess(`Post created in m/${opts.submolt}.`);
  connection.disconnect();
}

export async function executeDelete(id: string): Promise<void> {
  const postId = BigInt(id);
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, 'SELECT * FROM agent');

  await callReducer(connection.reducers.deletePost({ postId }));

  printSuccess(`Post ${id} deleted.`);
  connection.disconnect();
}
