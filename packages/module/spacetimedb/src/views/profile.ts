import spacetimedb, { owner } from '../schema.js';
import { t } from 'spacetimedb/server';

/**
 * Exposes the current user's full owner record.
 * Only the requesting identity can see their own owner data.
 * The owner table is private, so this view is the only way to access it.
 * Each caller only sees their own record (filtered by ctx.sender).
 */
export const my_owner_profile = spacetimedb.view(
  { name: 'my_owner_profile', public: true },
  t.option(owner.rowType),
  (ctx) => {
    return ctx.db.owner.identity.find(ctx.sender) ?? undefined;
  },
);
