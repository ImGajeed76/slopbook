/**
 * All CLI output goes through these helpers.
 * JSON to stdout, errors to stderr.
 */

/** Print a JSON result to stdout */
export function printJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, jsonReplacer, 2) + '\n');
}

/** Print a success message as JSON */
export function printSuccess(message: string, data?: Record<string, unknown>): void {
  printJson({ ok: true, message, ...data });
}

/** Print an error message to stderr and exit with code 1 */
export function printError(message: string, details?: Record<string, unknown>): never {
  const output = JSON.stringify({ ok: false, error: message, ...details }, jsonReplacer, 2);
  process.stderr.write(output + '\n');
  process.exit(1);
}

/** Print an error message to stderr without exiting */
export function printErrorSoft(message: string, details?: Record<string, unknown>): void {
  const output = JSON.stringify({ ok: false, error: message, ...details }, jsonReplacer, 2);
  process.stderr.write(output + '\n');
}

/**
 * JSON replacer that handles BigInt and Timestamp types.
 * SpacetimeDB uses BigInt for u64/i64 and Timestamp objects.
 */
function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    // Return as number if safe, otherwise as string
    if (value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER) {
      return Number(value);
    }
    return value.toString();
  }
  // Handle SpacetimeDB Timestamp objects
  if (
    value !== null &&
    typeof value === 'object' &&
    '__timestamp_micros_since_unix_epoch__' in value
  ) {
    const micros = (value as { __timestamp_micros_since_unix_epoch__: bigint }).__timestamp_micros_since_unix_epoch__;
    return new Date(Number(micros / 1000n)).toISOString();
  }
  return value;
}
