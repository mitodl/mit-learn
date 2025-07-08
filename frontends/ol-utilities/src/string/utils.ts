import isEmpty from "lodash/isEmpty"
import isNil from "lodash/isNil"

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
