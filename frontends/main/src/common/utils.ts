import { OrganizationPage } from "@mitodl/mitxonline-api-axios/v2"

const isInEnum = <T extends string>(
  value: string,
  enumObject: Record<string, T>,
): value is T => {
  return Object.values(enumObject).includes(value as T)
}

const matchOrganizationBySlug =
  (orgSlug: string) => (organization: OrganizationPage) => {
    return organization.slug.replace("org-", "") === orgSlug
  }

// Utility function to strip HTML tags and decode HTML entities
const stripHtmlAndDecode = (html: string): string => {
  if (!html) return ""

  let text = html

  // First decode HTML entities to normalize the input
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&") // Do this last to avoid double-decoding
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")

  // Remove dangerous tags with their content - iterate multiple times to handle nested cases
  for (let i = 0; i < 3; i++) {
    text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    text = text.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
  }

  // Remove any remaining script/style/iframe opening tags (even without closing tags)
  text = text.replace(/<script\b[^>]*>/gi, "")
  text = text.replace(/<\/script>/gi, "")
  text = text.replace(/<style\b[^>]*>/gi, "")
  text = text.replace(/<\/style>/gi, "")
  text = text.replace(/<iframe\b[^>]*>/gi, "")
  text = text.replace(/<\/iframe>/gi, "")

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]*>/g, "")

  // Remove URLs that might be left from embed code
  text = text.replace(/https?:\/\/[^\s]+/g, "")

  // Collapse multiple whitespace into single space
  text = text.replace(/\s+/g, " ")

  return text.trim()
}

export { isInEnum, matchOrganizationBySlug, stripHtmlAndDecode }
