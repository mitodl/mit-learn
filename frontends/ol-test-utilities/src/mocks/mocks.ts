/**
 * We use [jest-fail-on-console](https://www.npmjs.com/package/jest-fail-on-console)
 * to fail on console errors/warnings.
 *
 * This function allows us to temporarily disable that behavior for a test,
 * e.g., to test API error handling.
 */
const allowConsoleErrors = () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation()
  const consoleWarn = jest.spyOn(console, "warn").mockImplementation()
  return { consoleError, consoleWarn }
}

export { allowConsoleErrors }
