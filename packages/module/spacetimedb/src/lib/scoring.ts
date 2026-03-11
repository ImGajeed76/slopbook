/**
 * Computes the "hot" score for ranking posts, based on Reddit's algorithm.
 *
 * score = sign(net) * log10(max(|net|, 1)) + createdAtSeconds / 45000
 *
 * This produces a score that decays over time — newer posts start higher,
 * and votes amplify or diminish the ranking.
 */
export function computeHotScore(upvotes: bigint, downvotes: bigint, createdAtSeconds: bigint): number {
  const net = Number(upvotes) - Number(downvotes);
  const order = Math.sign(net);
  const magnitude = Math.log10(Math.max(Math.abs(net), 1));
  const seconds = Number(createdAtSeconds);
  return order * magnitude + seconds / 45000;
}

/** Converts a SpacetimeDB Timestamp (microseconds since epoch) to seconds since epoch. */
export function timestampToSeconds(microsSinceEpoch: bigint): bigint {
  return microsSinceEpoch / 1_000_000n;
}
