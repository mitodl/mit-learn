const EMAIL_REGEX =
  /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-][a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

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

export type EmailParseResult = {
  valid: string[]
  invalid: string[]
  duplicateCount: number
}

/**
 * Extract email addresses from pre-parsed CSV rows from PapaParse.
 * Scans all columns per row for the first value containing "@".
 *
 * Silently skips rows with no "@" (header rows, name columns, empty fields).
 * Values containing "@" that fail email validation are collected in `invalid`.
 * Duplicate emails (case-insensitive) within the rows are removed and counted.
 */
export const extractEmailsFromCsvRows = (
  rows: string[][],
): EmailParseResult => {
  const valid: string[] = []
  const invalid: string[] = []

  for (const cols of rows) {
    const emailCol = cols.map((c) => c.trim()).find((c) => c.includes("@"))
    if (!emailCol) continue
    if (EMAIL_REGEX.test(emailCol)) {
      valid.push(emailCol)
    } else {
      invalid.push(emailCol)
    }
  }

  const seen = new Set<string>()
  const deduped: string[] = []
  let duplicateCount = 0

  for (const email of valid) {
    const key = email.toLowerCase()
    if (seen.has(key)) {
      duplicateCount++
    } else {
      seen.add(key)
      deduped.push(email)
    }
  }

  return { valid: deduped, invalid, duplicateCount }
}

/**
 * Parse a comma-or-newline-separated email input string for submission.
 * Returns valid deduplicated emails, invalid tokens, and a duplicate count.
 */
export const parseEmailsForSubmit = (input: string): EmailParseResult => {
  const tokens = input
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const valid: string[] = []
  const invalid: string[] = []

  for (const token of tokens) {
    if (EMAIL_REGEX.test(token)) {
      valid.push(token)
    } else {
      invalid.push(token)
    }
  }

  const seen = new Set<string>()
  const deduped: string[] = []
  let duplicateCount = 0

  for (const email of valid) {
    const key = email.toLowerCase()
    if (seen.has(key)) {
      duplicateCount++
    } else {
      seen.add(key)
      deduped.push(email)
    }
  }

  return { valid: deduped, invalid, duplicateCount }
}

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
