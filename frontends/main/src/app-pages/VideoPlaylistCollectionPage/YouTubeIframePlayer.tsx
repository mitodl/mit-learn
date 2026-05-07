"use client"

import React from "react"

export type YouTubeIframePlayerProps = {
  videoId: string
  title?: string
  ariaLabel?: string
  ariaDescribedBy?: string
}

/**
 * Renders a plain YouTube embed iframe.
 *
 * Used instead of the VideoJS wrapper for YouTube videos so that:
 * - YouTube's native keyboard/accessibility controls work without conflict
 * - Thumbnail scrubbing and other native YouTube features are preserved
 */
const YouTubeIframePlayer: React.FC<YouTubeIframePlayerProps> = ({
  videoId,
  title,
  ariaLabel,
  ariaDescribedBy,
}) => {
  // Prefer the build-time env var; fall back to the browser's own origin at
  // runtime (always available in a "use client" component). Omit the param
  // entirely when neither is available (e.g. during SSR without the env var).
  const origin =
    process.env.NEXT_PUBLIC_ORIGIN ||
    (typeof window !== "undefined" ? window.location.origin : "")

  const params = new URLSearchParams({ rel: "0" })
  if (origin) params.set("origin", origin)

  const src = `https://www.youtube.com/embed/${videoId}?${params}`

  return (
    <iframe
      src={src}
      title={title ?? ariaLabel ?? "YouTube video player"}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        border: "none",
      }}
    />
  )
}

export default YouTubeIframePlayer
