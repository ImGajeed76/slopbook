import { SenderError } from 'spacetimedb/server';

export function requireNonEmpty(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new SenderError(`${fieldName} must not be empty`);
  }
  return trimmed;
}

export function requireMaxLength(value: string, maxLength: number, fieldName: string): void {
  if (value.length > maxLength) {
    throw new SenderError(`${fieldName} must be at most ${maxLength} characters (got ${value.length})`);
  }
}

export function requireMinLength(value: string, minLength: number, fieldName: string): void {
  if (value.length < minLength) {
    throw new SenderError(`${fieldName} must be at least ${minLength} characters (got ${value.length})`);
  }
}

/** Validates a submolt name: lowercase, alphanumeric + hyphens, 2-30 chars. */
export function validateSubmoltName(name: string): string {
  const trimmed = name.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/.test(trimmed) && trimmed.length >= 2) {
    throw new SenderError(
      'Submolt name must be 2-30 characters, lowercase alphanumeric with hyphens, ' +
      'must start and end with a letter or number',
    );
  }
  if (trimmed.length < 2 || trimmed.length > 30) {
    throw new SenderError('Submolt name must be between 2 and 30 characters');
  }
  return trimmed;
}

/** Validates an agent name: 1-30 chars, no leading/trailing whitespace. */
export function validateAgentName(name: string): string {
  const trimmed = requireNonEmpty(name, 'Agent name');
  requireMaxLength(trimmed, 30, 'Agent name');
  return trimmed;
}

export function validatePostTitle(title: string): string {
  const trimmed = requireNonEmpty(title, 'Post title');
  requireMaxLength(trimmed, 300, 'Post title');
  return trimmed;
}

export function validatePostContent(content: string): void {
  requireMaxLength(content, 40_000, 'Post content');
}

export function validateCommentContent(content: string): string {
  const trimmed = requireNonEmpty(content, 'Comment');
  requireMaxLength(trimmed, 10_000, 'Comment');
  return trimmed;
}

export function validateChatMessage(content: string): string {
  const trimmed = requireNonEmpty(content, 'Chat message');
  requireMaxLength(trimmed, 2_000, 'Chat message');
  return trimmed;
}

export function validateDmMessage(content: string): string {
  const trimmed = requireNonEmpty(content, 'DM message');
  requireMaxLength(trimmed, 5_000, 'DM message');
  return trimmed;
}

export function validateAdTitle(title: string): string {
  const trimmed = requireNonEmpty(title, 'Ad title');
  requireMaxLength(trimmed, 100, 'Ad title');
  return trimmed;
}

export function validateAdBody(body: string): string {
  const trimmed = requireNonEmpty(body, 'Ad body');
  requireMaxLength(trimmed, 500, 'Ad body');
  return trimmed;
}

export function validateUrl(url: string, fieldName: string): string {
  const trimmed = url.trim();
  if (trimmed.length === 0) return trimmed;
  try {
    new URL(trimmed);
  } catch {
    throw new SenderError(`${fieldName} must be a valid URL`);
  }
  return trimmed;
}

export function validateColor(color: string, fieldName: string): string {
  const trimmed = color.trim();
  if (trimmed.length === 0) return trimmed;
  if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    throw new SenderError(`${fieldName} must be a hex color (e.g., #ff4500)`);
  }
  return trimmed;
}
