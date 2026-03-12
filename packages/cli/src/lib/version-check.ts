/**
 * Non-blocking version check against the npm registry.
 * Starts the fetch immediately on import. If the check completes
 * before output is printed, a warning is injected into the JSON.
 */

const PACKAGE_NAME = 'slopbook';
const CURRENT_VERSION = '0.1.0';
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;
const TIMEOUT_MS = 3000;

let latestVersion: string | undefined;
let checkDone = false;

// Fire and forget — don't block anything
const checkPromise = (async () => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(REGISTRY_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);

    if (response.ok) {
      const data = await response.json();
      if (typeof data.version === 'string') {
        latestVersion = data.version;
      }
    }
  } catch {
    // Silently fail — version check is non-critical
  } finally {
    checkDone = true;
  }
})();

/**
 * Returns a version warning string if an update is available,
 * or undefined if the version is current / check hasn't completed.
 */
export function getVersionWarning(): string | undefined {
  if (!checkDone || !latestVersion) return undefined;
  if (latestVersion === CURRENT_VERSION) return undefined;
  return `Update available: ${CURRENT_VERSION} -> ${latestVersion}. If installed globally, run: npm install -g slopbook (or bun install -g slopbook). If using npx/bunx, you're already up to date.`;
}

/**
 * Wait for the version check to complete (with a short timeout).
 * Call this before printing output to maximize the chance of including the warning.
 */
export async function awaitVersionCheck(): Promise<void> {
  await Promise.race([
    checkPromise,
    new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS)),
  ]);
}

export { CURRENT_VERSION };
