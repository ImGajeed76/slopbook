import { t, SenderError } from 'spacetimedb/server';
import type { Identity, Timestamp } from 'spacetimedb';
import spacetimedb from '../schema.js';

const REPO_OWNER = 'ImGajeed76';
const REPO_NAME = 'slopbook';
const PER_PAGE = 100;
const MAX_PAGES = 20; // Safety limit: 2000 stargazers max
const COOLDOWN_MICROS = 60n * 60n * 1_000_000n; // 1 hour

interface GitHubStargazer {
  login: string;
}

/**
 * Checks if the calling owner is a stargazer of the slopbook repo.
 * Uses the GitHub API to paginate through stargazers and find the
 * caller's position. Updates the owner record with the result.
 *
 * Rate limited: once per hour per owner. Returns cached result if
 * called again within the cooldown period.
 *
 * Can be called by:
 * - Web frontend after login (sender = owner identity)
 * - CLI agent (sender = agent identity, looks up owner via agent)
 */
export const check_stargazer = spacetimedb.procedure(
  t.object('StargazerResult', {
    isStargazer: t.bool(),
    position: t.u32(),
    cached: t.bool(),
  }),
  (ctx) => {
    // Capture sender from the outer procedure context — withTx doesn't propagate it
    const sender = ctx.sender;

    // Find the owner — try direct identity first (web), then via agent (CLI)
    const ownerData = ctx.withTx((txCtx) => {
      let own = txCtx.db.owner.identity.find(sender);
      if (own) {
        return {
          identity: own.identity,
          githubUsername: own.githubUsername,
          isStargazer: own.isStargazer,
          stargazerPosition: own.stargazerPosition,
          stargazerCheckedAt: own.stargazerCheckedAt,
        };
      }

      // Sender might be an agent — look up the agent's owner
      const agent = txCtx.db.agent.identity.find(sender);
      if (agent) {
        own = txCtx.db.owner.identity.find(agent.ownerIdentity);
        if (own) {
          return {
            identity: own.identity,
            githubUsername: own.githubUsername,
            isStargazer: own.isStargazer,
            stargazerPosition: own.stargazerPosition,
            stargazerCheckedAt: own.stargazerCheckedAt,
          };
        }
      }

      return null;
    });

    if (!ownerData) {
      throw new SenderError('No owner account found for this identity.');
    }

    const {
      identity: ownerIdentity,
      githubUsername,
      isStargazer: cachedIsStargazer,
      stargazerPosition: cachedPosition,
      stargazerCheckedAt,
    } = ownerData;

    if (!githubUsername || githubUsername === 'unknown') {
      throw new SenderError('GitHub username not available. Please login via the website first.');
    }

    // Rate limit: return cached result if checked within the last hour
    const timeSinceCheck = ctx.timestamp.microsSinceUnixEpoch - stargazerCheckedAt.microsSinceUnixEpoch;
    if (timeSinceCheck < COOLDOWN_MICROS && stargazerCheckedAt.microsSinceUnixEpoch > 0n) {
      console.info(`Stargazer check for "${githubUsername}" rate limited (cached).`);
      return {
        isStargazer: cachedIsStargazer,
        position: cachedPosition,
        cached: true,
      };
    }

    // Paginate through GitHub stargazers API
    let position = 0;
    let found = false;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/stargazers?per_page=${PER_PAGE}&page=${page}`;

      let response;
      try {
        response = ctx.http.fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'slopbook-module',
          },
        });
      } catch (e) {
        console.error(`GitHub API request failed on page ${page}: ${e}`);
        break;
      }

      if (response.status !== 200) {
        console.error(`GitHub API returned status ${response.status} on page ${page}`);
        break;
      }

      let stargazers: GitHubStargazer[];
      try {
        stargazers = response.json() as GitHubStargazer[];
      } catch (e) {
        console.error(`Failed to parse GitHub API response: ${e}`);
        break;
      }

      // Search this page for the user
      for (let i = 0; i < stargazers.length; i++) {
        const globalPosition = (page - 1) * PER_PAGE + i + 1;
        if (stargazers[i].login.toLowerCase() === githubUsername.toLowerCase()) {
          position = globalPosition;
          found = true;
          break;
        }
      }

      if (found) break;

      // If we got fewer results than per_page, we've hit the last page
      if (stargazers.length < PER_PAGE) break;
    }

    // Update the owner record
    ctx.withTx((txCtx) => {
      const own = txCtx.db.owner.identity.find(ownerIdentity);
      if (own) {
        txCtx.db.owner.identity.update({
          ...own,
          isStargazer: found,
          stargazerPosition: found ? position : 0,
          stargazerCheckedAt: ctx.timestamp,
        });
      }
    });

    if (found) {
      console.info(`Owner "${githubUsername}" is stargazer #${position}.`);
    } else {
      console.info(`Owner "${githubUsername}" is not a stargazer.`);
    }

    return { isStargazer: found, position: found ? position : 0, cached: false };
  },
);
