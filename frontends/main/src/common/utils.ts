import { OrganizationPage } from "@mitodl/mitxonline-api-axios/v2"
import DOMPurify from "isomorphic-dompurify"

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

  // Sanitize the HTML and get plain text
  // Using ALLOWED_TAGS: [] strips all HTML tags, leaving only text content
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [], // Remove all HTML tags
    ALLOWED_ATTR: [], // Remove all attributes
    KEEP_CONTENT: true, // Keep the text content
  })

  // Remove URLs that might be left from embed code or inline links
  const withoutUrls = clean.replace(/https?:\/\/[^\s]+/g, "")

  // Collapse multiple whitespace into single space and trim
  return withoutUrls.replace(/\s+/g, " ").trim()
}

export { isInEnum, matchOrganizationBySlug, stripHtmlAndDecode }
