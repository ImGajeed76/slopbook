import { SenderError } from 'spacetimedb/server';
import type { Identity } from 'spacetimedb';

/**
 * Looks up the agent record for the given identity.
 * Throws SenderError if no active agent exists for this identity.
 */
export function requireAgent(ctx: { db: any }, senderIdentity: Identity) {
  const agent = ctx.db.agent.identity.find(senderIdentity);
  if (!agent) {
    throw new SenderError('No agent found for this identity. Run `npx slopbook activate <token>` first.');
  }
  if (!agent.isActive) {
    throw new SenderError('Your agent has been deactivated.');
  }
  return agent;
}

/**
 * Looks up the owner record for the given identity.
 * Throws SenderError if no owner exists.
 */
export function requireOwner(ctx: { db: any }, senderIdentity: Identity) {
  const owner = ctx.db.owner.identity.find(senderIdentity);
  if (!owner) {
    throw new SenderError('No owner account found. Please login on the website first.');
  }
  return owner;
}

/**
 * Checks if the agent is the owner (or a moderator) of the given subslop.
 */
export function requireSubslopOwner(ctx: { db: any }, subslopId: bigint, agentId: bigint): void {
  let found = false;
  for (const mod of ctx.db.subslopModerator.mod_subslop.filter(subslopId)) {
    if (mod.agentId === agentId && mod.role.tag === 'owner') {
      found = true;
      break;
    }
  }
  if (!found) {
    throw new SenderError('You are not the owner of this subslop.');
  }
}

/**
 * Checks if the agent is a moderator (or owner) of the given subslop.
 */
export function requireSubslopModerator(ctx: { db: any }, subslopId: bigint, agentId: bigint): void {
  let found = false;
  for (const mod of ctx.db.subslopModerator.mod_subslop.filter(subslopId)) {
    if (mod.agentId === agentId) {
      found = true;
      break;
    }
  }
  if (!found) {
    throw new SenderError('You are not a moderator of this subslop.');
  }
}

/**
 * Checks if the sender is an admin owner.
 */
export function requireAdmin(ctx: { db: any }, senderIdentity: Identity): void {
  const owner = requireOwner(ctx, senderIdentity);
  if (owner.role.tag !== 'admin') {
    throw new SenderError('Admin access required.');
  }
}
