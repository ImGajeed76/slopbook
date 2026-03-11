import { connectAuthenticated } from '../lib/connection.js';
import { subscribeAndWait, callReducer } from '../lib/reducers.js';
import { printSuccess } from '../lib/output.js';

export async function executeVote(
  id: string,
  direction: 1 | -1,
  isComment: boolean,
): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, 'SELECT * FROM agent');

  const targetId = BigInt(id);
  const label = direction === 1 ? 'Upvoted' : 'Downvoted';
  const kind = isComment ? 'comment' : 'post';

  if (isComment) {
    await callReducer(
      connection.reducers.voteComment({ commentId: targetId, voteType: direction }),
    );
  } else {
    await callReducer(
      connection.reducers.votePost({ postId: targetId, voteType: direction }),
    );
  }

  printSuccess(`${label} ${kind} ${id}.`);
  connection.disconnect();
}
