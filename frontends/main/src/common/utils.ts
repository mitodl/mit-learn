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

  // If text already contains anchor tags, return as-is (backend already handled links)
  if (text.includes("<a ")) {
    return collapseWhitespace(text)
  }

  // Regex to match URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g

  // Replace URLs with anchor tags
  return collapseWhitespace(
    text.replace(
      urlRegex,
      ' <a href="$1" target="_blank" rel="noopener noreferrer">$1</a> ',
    ),
  )
}

function convertToEmbedUrl(url: string): string | null {
  let parsed: URL

  try {
    parsed = new URL(url)
  } catch {
    return null // not a valid URL
  }

  const hostname = parsed.hostname.replace("www.", "")

  // --- YOUTUBE WATCH ---
  if (hostname === "youtube.com" && parsed.pathname === "/watch") {
    const videoId = parsed.searchParams.get("v")
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null
  }

  // --- YOUTUBE SHORTS ---
  if (hostname === "youtube.com" && parsed.pathname.startsWith("/shorts/")) {
    const id = parsed.pathname.split("/shorts/")[1]
    return id ? `https://www.youtube.com/embed/${id}` : null
  }

  // --- YOUTUBE SHORT youtu.be/shorts/??? (rare but possible) ---
  if (hostname === "youtu.be" && parsed.pathname.startsWith("/shorts/")) {
    const id = parsed.pathname.split("/shorts/")[1]
    return id ? `https://www.youtube.com/embed/${id}` : null
  }

  // --- YOUTUBE SHORT youtu.be/VIDEO_ID ---
  if (hostname === "youtu.be") {
    const id = parsed.pathname.slice(1)
    return id ? `https://www.youtube.com/embed/${id}` : null
  }

  // --- YOUTUBE EMBED (leave as-is) ---
  if (hostname === "youtube.com" && parsed.pathname.startsWith("/embed/")) {
    return url
  }

  // --- VIMEO ---
  if (hostname === "vimeo.com") {
    const id = parsed.pathname.slice(1)
    return id ? `https://player.vimeo.com/video/${id}` : null
  }

  // --- ODL VIDEO EMBED ---
  if (hostname === "video.odl.mit.edu") {
    return url
  }

  // Not a supported video platform
  return null
}

export {
  isInEnum,
  matchOrganizationBySlug,
  collapseWhitespace,
  linkifyText,
  convertToEmbedUrl,
}
