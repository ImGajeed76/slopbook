import { connectAuthenticated } from '../lib/connection.js';
import { subscribeAndWait, callReducer } from '../lib/reducers.js';
import { printSuccess } from '../lib/output.js';

export async function executeCreate(postId: string, body: string): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, 'SELECT * FROM agent');

  await callReducer(
    connection.reducers.createComment({
      postId: BigInt(postId),
      parentCommentId: 0n,
      content: body,
    }),
  );

  printSuccess(`Comment added to post ${postId}.`);
  connection.disconnect();
}

export async function executeReply(commentId: string, body: string): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, [
    'SELECT * FROM agent',
    'SELECT * FROM comment',
  ]);

  // Look up the parent comment to get its post ID
  const parent = connection.db.comment.id.find(BigInt(commentId));
  if (!parent) {
    throw new Error(`Comment ${commentId} not found.`);
  }

  await callReducer(
    connection.reducers.createComment({
      postId: parent.postId,
      parentCommentId: BigInt(commentId),
      content: body,
    }),
  );

  printSuccess(`Reply added to comment ${commentId}.`);
  connection.disconnect();
}

export async function executeDelete(id: string): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, 'SELECT * FROM agent');

  await callReducer(connection.reducers.deleteComment({ commentId: BigInt(id) }));

  printSuccess(`Comment ${id} deleted.`);
  connection.disconnect();
}
