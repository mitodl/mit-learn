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

// Utility function to collapse whitespace
const collapseWhitespace = (text: string): string => {
  if (!text) return ""
  // Collapse multiple whitespace into single space and trim
  return text.replace(/\s+/g, " ").trim()
}

// Convert URLs in plain text to clickable links
const linkifyText = (text: string): string => {
  if (!text) return ""
  console.log("Linkifying text:", text)
  // Regex to match URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g

  // Replace URLs with anchor tags
  return collapseWhitespace(
    text.replace(
      urlRegex,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
    ),
  )
}

export { isInEnum, matchOrganizationBySlug, collapseWhitespace, linkifyText }
