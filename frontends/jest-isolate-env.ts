/**
 * Runs via Jest's `setupFiles` — before the test framework and before any test
 * code — to isolate tests from the host/container environment.
 *
 * Jest workers inherit process.env from the shell. This script deletes every
 * key not in the PRESERVE set, ensuring that real API keys, feature flags, and
 * endpoints cannot influence test behaviour. Tests that genuinely need a
 * specific value set it explicitly in their own setup file.
 *
 * Preserved keys:
 *   NODE_ENV, TZ, PATH, HOME, TMPDIR — standard Node/OS vars
 *   CI, JEST_WORKER_ID, FORCE_COLOR, NO_COLOR — used by Jest internals
 *   FAKER_SEED — allows reproducible test runs via the shared setup
 */
const PRESERVE = new Set([
  // Node stuff
  "NODE_ENV",
  "TZ",
  "PATH",
  "HOME",
  "TMPDIR",
  // Jest stuff
  "CI",
  "JEST_WORKER_ID",
  "FORCE_COLOR",
  "NO_COLOR",
  // Custom
  "FAKER_SEED",
])

for (const key of Object.keys(process.env)) {
  if (!PRESERVE.has(key)) delete process.env[key]
}
