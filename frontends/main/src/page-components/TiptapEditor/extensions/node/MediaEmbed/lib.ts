export function isVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      parsed.pathname.toLowerCase().endsWith(".mp4") ||
      parsed.pathname.toLowerCase().endsWith(".m3u8")
    )
  } catch {
    return false
  }
}

export function convertToEmbedUrl(url: string): string | null {
  let parsed: URL

  try {
    parsed = new URL(url)
  } catch {
    return null // not a valid URL
  }
  const hostname = parsed.hostname.replace("www.", "")

  // Helper to ensure URL has protocol
  const ensureProtocol = (urlOrHost: string) => {
    return urlOrHost.startsWith("http") ? urlOrHost : `https://${urlOrHost}`
  }

  // --- MIT LEARN MP4 VIDEOS ---
  if (
    hostname ===
      new URL(
        ensureProtocol(
          process.env.NEXT_PUBLIC_ORIGIN || "https://learn.mit.edu",
        ),
      ).hostname.replace("www.", "") &&
    parsed.pathname.toLowerCase().endsWith(".mp4")
  ) {
    return url // Return the URL as-is for video element
  }

  // --- CLOUDFRONT M3U8 VIDEOS ---

  if (
    hostname ===
      new URL(
        ensureProtocol(
          process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN ||
            "https://d3tsb3m56iwvoq.cloudfront.net",
        ),
      ).hostname.replace("www.", "") &&
    parsed.pathname.toLowerCase().endsWith(".m3u8")
  ) {
    return url // Return the URL as-is for video element
  }

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

  // Not a supported video platform
  return null
}
