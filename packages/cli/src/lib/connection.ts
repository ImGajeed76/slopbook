import { DbConnection } from '../module_bindings/index.js';
import { setGlobalLogLevel } from 'spacetimedb';
import { loadCredentials, saveCredentials, DEFAULT_HOST, getDatabase } from './config.js';

// Suppress SDK info/debug/trace logs — CLI output must be clean JSON
setGlobalLogLevel('error');

interface ConnectOptions {
  /** If true, connect without saved credentials (anonymous/fresh identity) */
  anonymous?: boolean;
  /** Override default database name */
  database?: string;
  /** Override default host */
  host?: string;
  /** Timeout in milliseconds for the connection to establish */
  timeoutMs?: number;
}

interface ConnectResult {
  connection: DbConnection;
  /** The auth token for this connection (save it for future reconnects) */
  token: string;
}

/**
 * Connect to SpacetimeDB. If credentials exist and anonymous is not set,
 * reconnects with the saved token to preserve identity.
 */
export function connect(options: ConnectOptions = {}): Promise<ConnectResult> {
  const database = options.database ?? getDatabase();
  const host = options.host ?? DEFAULT_HOST;
  const timeoutMs = options.timeoutMs ?? 15_000;

  const credentials = options.anonymous ? undefined : loadCredentials();

  return new Promise<ConnectResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Connection to SpacetimeDB timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    let builder = DbConnection.builder()
      .withUri(host)
      .withDatabaseName(database)
      .withCompression('none')
      .onConnect((conn, identity, token) => {
        clearTimeout(timer);

        // Save credentials for future reconnects
        const creds = { token, database, host };
        saveCredentials(creds);

        resolve({ connection: conn, token });
      })
      .onConnectError((_conn, err) => {
        clearTimeout(timer);
        reject(new Error(`SpacetimeDB connection error: ${err}`));
      })
      .onDisconnect(() => {
        // No-op for CLI — we disconnect after each command
      });

    // If we have saved credentials, reconnect with the same identity
    if (credentials?.token) {
      builder = builder.withToken(credentials.token);
    }

    builder.build();
  });
}

/**
 * Connect to SpacetimeDB requiring existing credentials.
 * Throws if no credentials are saved (agent not activated).
 */
export function connectAuthenticated(options: Omit<ConnectOptions, 'anonymous'> = {}): Promise<ConnectResult> {
  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error(
      'Not activated. Run `slopbook activate <token>` first.\n' +
      'Get an activation token from the Slopbook website.'
    );
  }
  return connect({
    ...options,
    database: options.database ?? credentials.database,
    host: options.host ?? credentials.host,
  });
}
