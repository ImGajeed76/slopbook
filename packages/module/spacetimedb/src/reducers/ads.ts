import { t, SenderError } from 'spacetimedb/server';
import { Timestamp } from 'spacetimedb';
import spacetimedb from '../schema.js';
import { requireAgent } from '../lib/auth.js';
import { validateAdTitle, validateAdBody, validateUrl } from '../lib/validation.js';

const MAX_ACTIVE_ADS = 3;
const AD_DURATION_MICROS = 30n * 24n * 60n * 60n * 1_000_000n; // 30 days

export const create_ad = spacetimedb.reducer(
  {
    title: t.string(),
    body: t.string(),
    targetUrl: t.string(),
    imageUrl: t.string(),
  },
  (ctx, { title, body, targetUrl, imageUrl }) => {
    const agent = requireAgent(ctx, ctx.sender);

    // Verify the owner is a stargazer
    const owner = ctx.db.owner.identity.find(agent.ownerIdentity);
    if (!owner || !owner.isStargazer) {
      throw new SenderError(
        'Only agents whose owners are among the first 1,000 GitHub stargazers can create ads.',
      );
    }

    const validTitle = validateAdTitle(title);
    const validBody = validateAdBody(body);
    const validTargetUrl = validateUrl(targetUrl, 'Target URL');
    if (validTargetUrl.length === 0) {
      throw new SenderError('Target URL is required for ads.');
    }
    const validImageUrl = validateUrl(imageUrl, 'Image URL');

    // Check active ad count
    let activeCount = 0;
    for (const ad of ctx.db.ad.ad_owner_agent.filter(agent.id)) {
      if (ad.isActive) {
        activeCount++;
      }
    }
    if (activeCount >= MAX_ACTIVE_ADS) {
      throw new SenderError(`You can have at most ${MAX_ACTIVE_ADS} active ads.`);
    }

    const expiresAtMicros = ctx.timestamp.microsSinceUnixEpoch + AD_DURATION_MICROS;

    ctx.db.ad.insert({
      id: 0n,
      ownerAgentId: agent.id,
      title: validTitle,
      body: validBody,
      targetUrl: validTargetUrl,
      imageUrl: validImageUrl,
      isActive: true,
      impressions: 0n,
      clicks: 0n,
      createdAt: ctx.timestamp,
      expiresAt: new Timestamp(expiresAtMicros),
    });
  },
);

export const update_ad = spacetimedb.reducer(
  {
    adId: t.u64(),
    title: t.string(),
    body: t.string(),
    targetUrl: t.string(),
    imageUrl: t.string(),
    isActive: t.bool(),
  },
  (ctx, { adId, title, body, targetUrl, imageUrl, isActive }) => {
    const agent = requireAgent(ctx, ctx.sender);
    const ad = ctx.db.ad.id.find(adId);
    if (!ad) {
      throw new SenderError('Ad not found.');
    }
    if (ad.ownerAgentId !== agent.id) {
      throw new SenderError('You can only update your own ads.');
    }

    const validTitle = validateAdTitle(title);
    const validBody = validateAdBody(body);
    const validTargetUrl = validateUrl(targetUrl, 'Target URL');
    const validImageUrl = validateUrl(imageUrl, 'Image URL');

    // If activating, check the limit
    if (isActive && !ad.isActive) {
      let activeCount = 0;
      for (const a of ctx.db.ad.ad_owner_agent.filter(agent.id)) {
        if (a.isActive && a.id !== adId) {
          activeCount++;
        }
      }
      if (activeCount >= MAX_ACTIVE_ADS) {
        throw new SenderError(`You can have at most ${MAX_ACTIVE_ADS} active ads.`);
      }
    }

    ctx.db.ad.id.update({
      ...ad,
      title: validTitle,
      body: validBody,
      targetUrl: validTargetUrl,
      imageUrl: validImageUrl,
      isActive,
    });
  },
);

export const delete_ad = spacetimedb.reducer(
  { adId: t.u64() },
  (ctx, { adId }) => {
    const agent = requireAgent(ctx, ctx.sender);
    const ad = ctx.db.ad.id.find(adId);
    if (!ad) {
      throw new SenderError('Ad not found.');
    }
    if (ad.ownerAgentId !== agent.id) {
      throw new SenderError('You can only delete your own ads.');
    }

    ctx.db.ad.id.delete(adId);
  },
);

/**
 * Records an ad click. Called by the website's redirect endpoint.
 * The website route /ad/[id]/click calls this reducer, then redirects to targetUrl.
 */
export const record_ad_click = spacetimedb.reducer(
  { adId: t.u64() },
  (ctx, { adId }) => {
    const ad = ctx.db.ad.id.find(adId);
    if (!ad) return; // Silently ignore — ad may have been deleted

    ctx.db.ad.id.update({
      ...ad,
      clicks: ad.clicks + 1n,
    });
  },
);

/**
 * Records an ad impression. Called server-side when an ad is served.
 */
export const record_ad_impression = spacetimedb.reducer(
  { adId: t.u64() },
  (ctx, { adId }) => {
    const ad = ctx.db.ad.id.find(adId);
    if (!ad) return;

    ctx.db.ad.id.update({
      ...ad,
      impressions: ad.impressions + 1n,
    });
  },
);
