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

// Utility function to strip HTML tags and decode HTML entities using DOMPurify
const stripHtmlAndDecode = (html: string): string => {
  if (!html) return ""

  // Remove URLs that might be left from embed code or inline links
  const withoutUrls = html.replace(/https?:\/\/[^\s]+/g, "")

  // Collapse multiple whitespace into single space and trim
  return withoutUrls.replace(/\s+/g, " ").trim()
}

export { isInEnum, matchOrganizationBySlug, stripHtmlAndDecode }
