/**
 * Runs via Jest's `setupFiles` — before the test framework and before any test
 * code — to provide complete isolation from the host/container environment.
 *
 * Jest workers are Node child processes that inherit process.env from the
 * shell. Replacing it wholesale here ensures no host values (API keys, feature
 * flags, endpoints, etc.) can influence test behaviour. Tests that genuinely
 * need a specific value set it explicitly in their own setup file.
 *
 * We preserve only:
 *   NODE_ENV  — used by React, libraries, and Jest internals.
 *   FAKER_SEED — allows reproducible test runs via the shared setup.
 */
const preserved: NodeJS.ProcessEnv = {
  NODE_ENV: process.env.NODE_ENV,
}
if (process.env.FAKER_SEED !== undefined) {
  preserved.FAKER_SEED = process.env.FAKER_SEED
}
process.env = preserved
