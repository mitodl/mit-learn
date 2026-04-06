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

function hexToRgba(
  hex: string,
  alpha: number,
):
  | readonly string[]
  | import("csstype").Property.BackgroundColor
  | readonly import("csstype").Property.BackgroundColor[]
  | undefined {
  const normalized = hex.trim().replace(/^#/, "")

  if (![3, 4, 6, 8].includes(normalized.length)) {
    return undefined
  }

  const expanded =
    normalized.length === 3 || normalized.length === 4
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized

  const hasAlpha = expanded.length === 8
  const r = Number.parseInt(expanded.slice(0, 2), 16)
  const g = Number.parseInt(expanded.slice(2, 4), 16)
  const b = Number.parseInt(expanded.slice(4, 6), 16)

  if ([r, g, b].some(Number.isNaN)) {
    return undefined
  }

  const hexAlpha = hasAlpha
    ? Number.parseInt(expanded.slice(6, 8), 16) / 255
    : 1

  if (Number.isNaN(hexAlpha)) {
    return undefined
  }

  const clampedAlpha = Math.max(0, Math.min(1, alpha * hexAlpha))

  return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`
}

export {
  isInEnum,
  matchOrganizationBySlug,
  collapseWhitespace,
  linkifyText,
  convertToEmbedUrl,
  hexToRgba,
}
