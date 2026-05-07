"use client"

import React from "react"

const ORIGIN = process.env.NEXT_PUBLIC_ORIGIN ?? ""

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
  const src = `https://www.youtube.com/embed/${videoId}?rel=0&origin=${encodeURIComponent(ORIGIN)}`

  return (
    <iframe
      src={src}
      title={title ?? ariaLabel ?? "YouTube video player"}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
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
