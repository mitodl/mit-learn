/**
 * Parse a sample rate from an environment variable.
 * Returns the default value when the variable is absent, empty, or not a
 * valid number in [0, 1].
 */
export function parseSampleRate(
  value: string | undefined,
  defaultRate: number,
): number {
  const rate = parseFloat(value ?? "")
  return Number.isNaN(rate) ? defaultRate : Math.min(1, Math.max(0, rate))
}
