/**
 * CLI version -- single source of truth is package.json.
 *
 * Imported as JSON at build time so the version string is inlined
 * into the bundle. No more hardcoded version in multiple places.
 */
import pkg from '../../package.json';

export const VERSION: string = pkg.version;
