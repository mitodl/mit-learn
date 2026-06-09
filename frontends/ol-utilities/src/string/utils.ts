// HTML5 spec regex — matches browser-native <input type="email"> validation
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

export const isValidEmail = (email: string): boolean => EMAIL_REGEX.test(email)

/**
 * Parse a comma-or-newline-separated string of email addresses into an array
 * of objects indicating whether each token is a valid email address.
 */
export const parseEmails = (input: string) =>
  input
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((email) => ({ email, valid: EMAIL_REGEX.test(email) }))

/**
 * Extract email addresses from CSV text. Takes the first column of each row,
 * strips any header row (non-email values are silently skipped), and returns
 * a comma-separated string ready to paste into the email textarea.
 */
export const parseCsvToEmails = (csv: string): string =>
  csv
    .split(/\r?\n/)
    .map((row) => row.split(",")[0]?.trim() ?? "")
    .filter((val) => EMAIL_REGEX.test(val))
    .join(", ")

export const initials = (title: string): string => {
  return title
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => (item[0] ?? "").toUpperCase())
    .join("")
}

export const capitalize = (txt: string) =>
  (txt[0] ?? "").toUpperCase() + txt.slice(1).toLowerCase()

/**
 * Append an 's' to the end of a string if the count is not 1. Optionally,
 * provide a custom plural string.
 */
export const pluralize = (singular: string, count: number, plural?: string) => {
  if (count === 1) {
    return singular
  }
  return plural ?? `${singular}s`
}
