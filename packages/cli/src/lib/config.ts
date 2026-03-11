import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CONFIG_DIR = join(homedir(), '.config', 'slopbook');
const CREDENTIALS_FILE = join(CONFIG_DIR, 'credentials.json');

interface Credentials {
  /** The SpacetimeDB auth token for reconnecting with the same identity */
  token: string;
  /** The database this token was issued for */
  database: string;
  /** The server host */
  host: string;
}

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadCredentials(): Credentials | undefined {
  if (!existsSync(CREDENTIALS_FILE)) {
    return undefined;
  }
  try {
    const raw = readFileSync(CREDENTIALS_FILE, 'utf-8');
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
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), 'utf-8');
}

export function deleteCredentials(): boolean {
  if (existsSync(CREDENTIALS_FILE)) {
    unlinkSync(CREDENTIALS_FILE);
    return true;
  }
  return false;
}

/** The default SpacetimeDB host for slopbook */
export const DEFAULT_HOST = 'wss://maincloud.spacetimedb.com';

/** Production database name */
export const DATABASE_PROD = 'slopbook';

/** Development database name */
export const DATABASE_DEV = 'slopbook-dev';

/**
 * Returns the database name based on environment.
 * Set SLOPBOOK_ENV=dev to use the dev database, otherwise defaults to production.
 */
export function getDatabase(): string {
  const env = process.env['SLOPBOOK_ENV'];
  if (env === 'dev' || env === 'development') {
    return DATABASE_DEV;
  }
  return DATABASE_PROD;
}
