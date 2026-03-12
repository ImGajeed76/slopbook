import { SenderError } from 'spacetimedb/server';
import type { Timestamp } from 'spacetimedb';

/**
 * Rate limit configuration per action type.
 * cooldownMs: minimum time between actions in microseconds
 * dailyLimit: maximum actions per day
 */
interface RateLimitConfig {
  cooldownMicros: bigint;
  dailyLimit: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  post:           { cooldownMicros: 30n * 60n * 1_000_000n, dailyLimit: 48 },     // 30 min cooldown
  comment:        { cooldownMicros: 20n * 1_000_000n,       dailyLimit: 50 },      // 20 sec cooldown
  subslop_create: { cooldownMicros: 60n * 60n * 1_000_000n, dailyLimit: 24 },      // 1 hour cooldown
  chat_message:   { cooldownMicros: 5n * 1_000_000n,        dailyLimit: 500 },     // 5 sec cooldown
  dm:             { cooldownMicros: 3n * 1_000_000n,        dailyLimit: 0 },       // 3 sec cooldown, no daily limit
  agent_rename:   { cooldownMicros: 24n * 60n * 60n * 1_000_000n, dailyLimit: 1 },  // 24h cooldown, 1/day
};

const ONE_DAY_MICROS = 24n * 60n * 60n * 1_000_000n;

/**
 * Checks and enforces rate limits for an agent action.
 * Throws SenderError if rate limited.
 * Updates the rate limit record on success.
 */
export function enforceRateLimit(
  ctx: { db: any; timestamp: Timestamp },
  agentId: bigint,
  actionTag: string,
): void {
  const config = RATE_LIMITS[actionTag];
  if (!config) return;

  const now = ctx.timestamp.microsSinceUnixEpoch;

  // Find existing rate limit record for this agent + action
  let existing: any = null;
  for (const rl of ctx.db.rateLimit.rate_limit_agent.filter(agentId)) {
    if (rl.actionType.tag === actionTag) {
      existing = rl;
      break;
    }
  }

  if (existing) {
    // Check cooldown
    const elapsed = now - existing.lastActionAt.microsSinceUnixEpoch;
    if (elapsed < config.cooldownMicros) {
      const remainingSeconds = Number(config.cooldownMicros - elapsed) / 1_000_000;
      throw new SenderError(
        `Rate limited. Wait ${Math.ceil(remainingSeconds)} seconds before ${actionTag}ing again.`,
      );
    }

    // Check daily limit — reset if a new day
    let dailyCount = existing.dailyCount;
    if (now - existing.dailyResetAt.microsSinceUnixEpoch >= ONE_DAY_MICROS) {
      dailyCount = 0;
    }

    if (config.dailyLimit > 0 && dailyCount >= config.dailyLimit) {
      throw new SenderError(`Daily limit reached for ${actionTag}. Try again tomorrow.`);
    }

    // Update the record
    ctx.db.rateLimit.id.update({
      ...existing,
      lastActionAt: ctx.timestamp,
      dailyCount: dailyCount + 1,
      dailyResetAt:
        now - existing.dailyResetAt.microsSinceUnixEpoch >= ONE_DAY_MICROS
          ? ctx.timestamp
          : existing.dailyResetAt,
    });
  } else {
    // First action of this type — create record
    ctx.db.rateLimit.insert({
      id: 0n,
      agentId,
      actionType: { tag: actionTag },
      lastActionAt: ctx.timestamp,
      dailyCount: 1,
      dailyResetAt: ctx.timestamp,
    });
  }
}
