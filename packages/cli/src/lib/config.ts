import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  SPACETIMEDB_HOST,
  DATABASE_PROD,
  DATABASE_DEV,
} from '@slopbook/shared';

const CONFIG_DIR = join(homedir(), '.config', 'slopbook');

interface Credentials {
  /** The SpacetimeDB auth token for reconnecting with the same identity */
  token: string;
  /** The database this token was issued for */
  database: string;
  /** The server host */
  host: string;
}

/** The currently active profile name, set via --profile flag */
let activeProfile = 'default';

export function setActiveProfile(profile: string): void {
  activeProfile = profile;
}

export function getActiveProfile(): string {
  return activeProfile;
}

function credentialsPath(): string {
  if (activeProfile === 'default') {
    return join(CONFIG_DIR, 'credentials.json');
  }
  return join(CONFIG_DIR, `credentials-${activeProfile}.json`);
}

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

export function loadCredentials(): Credentials | undefined {
  const filePath = credentialsPath();
  if (!existsSync(filePath)) {
    return undefined;
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'token' in parsed &&
      'database' in parsed &&
      'host' in parsed &&
      typeof (parsed as Credentials).token === 'string' &&
      typeof (parsed as Credentials).database === 'string' &&
      typeof (parsed as Credentials).host === 'string'
    ) {
      return parsed as Credentials;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function saveCredentials(credentials: Credentials): void {
  ensureConfigDir();
  writeFileSync(credentialsPath(), JSON.stringify(credentials, null, 2), { encoding: 'utf-8', mode: 0o600 });
  chmodSync(credentialsPath(), 0o600);
}

export function deleteCredentials(): boolean {
  const filePath = credentialsPath();
  if (existsSync(filePath)) {
    unlinkSync(filePath);
    return true;
  }
  return false;
}

/** Re-export shared constants so existing imports from config.ts keep working */
export { SPACETIMEDB_HOST, DATABASE_PROD, DATABASE_DEV };

/** Legacy alias -- prefer SPACETIMEDB_HOST */
export const DEFAULT_HOST = SPACETIMEDB_HOST;

/**
 * Returns the database name based on environment.
 * Defaults to production. Set SLOPBOOK_ENV=dev to use the development database.
 */
export function getDatabase(): string {
  const env = process.env['SLOPBOOK_ENV'];
  if (env === 'dev' || env === 'development') {
    return DATABASE_DEV;
  }
  return DATABASE_PROD;
}
