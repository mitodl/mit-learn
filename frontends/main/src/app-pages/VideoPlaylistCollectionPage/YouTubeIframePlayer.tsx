"use client"

import React from "react"
import invariant from "tiny-invariant"

const NEXT_PUBLIC_ORIGIN = process.env.NEXT_PUBLIC_ORIGIN
invariant(NEXT_PUBLIC_ORIGIN, "NEXT_PUBLIC_ORIGIN must be defined")

export type YouTubeIframePlayerProps = {
  embedUrl: string
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
 *
 * Accepts a base `embedUrl` (e.g. from `convertToEmbedUrl`) and appends
 * the required `rel=0` and `origin` query params automatically.
 */
const YouTubeIframePlayer: React.FC<YouTubeIframePlayerProps> = ({
  embedUrl,
  title,
  ariaLabel,
  ariaDescribedBy,
}) => {
  const url = new URL(embedUrl)
  url.searchParams.set("rel", "0")
  url.searchParams.set("origin", NEXT_PUBLIC_ORIGIN)

  const src = url.toString()

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
