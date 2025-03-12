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

export const emptyOrNil = (x: unknown): boolean => isNil(x) || isEmpty(x)

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

/**
 * Extracts a JSON object from a comment string
 * @param comment the comment string
 * @returns the JSON object
 */
export const extractJSONFromComment = (comment: string) => {
  const jsonStr = comment.toString().match(/<!-{2}(.*)-{2}>/)?.[1] || "{}"
  try {
    return JSON.parse(jsonStr)
  } catch (e) {
    console.error("error parsing JSON from comment", comment, e)
    return {}
  }
}
