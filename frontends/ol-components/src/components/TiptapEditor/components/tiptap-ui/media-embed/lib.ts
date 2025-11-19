export function convertToEmbedUrl(url: string): string {
  let parsed: URL

  try {
    parsed = new URL(url)
  } catch {
    return url // not a valid URL
  }

  const hostname = parsed.hostname.replace("www.", "")

  // --- YOUTUBE WATCH ---
  if (hostname === "youtube.com" && parsed.pathname === "/watch") {
    const videoId = parsed.searchParams.get("v")
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url
  }

  // --- YOUTUBE SHORT ---
  if (hostname === "youtu.be") {
    const id = parsed.pathname.slice(1)
    return id ? `https://www.youtube.com/embed/${id}` : url
  }

  // --- YOUTUBE /embed or other formats keep as is ---
  if (hostname === "youtube.com" && parsed.pathname.startsWith("/embed/")) {
    return url
  }

  // --- VIMEO ---
  if (hostname === "vimeo.com") {
    const id = parsed.pathname.slice(1)
    return id ? `https://player.vimeo.com/video/${id}` : url
  }

  return url // fallback
}
