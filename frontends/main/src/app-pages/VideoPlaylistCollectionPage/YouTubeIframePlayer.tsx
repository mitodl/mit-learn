"use client"

import { requiredEnv } from "@/env"
import React, { useEffect, useId, useImperativeHandle, useRef } from "react"

export type YouTubePlayerHandle = {
  getCurrentTime: () => number
}

export type YouTubeIframePlayerProps = {
  embedUrl: string
  title?: string
  ariaLabel?: string
  ariaDescribedBy?: string
  startTime?: number
}

interface YTPlayerInstance {
  getCurrentTime(): number
  destroy(): void
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementOrId: HTMLElement | string,
        options?: {
          events?: {
            onReady?: () => void
          }
        },
      ) => YTPlayerInstance
    }
    onYouTubeIframeAPIReady?: () => void
    _ytApiCallbacks?: Array<() => void>
  }
}

/**
 * Loads the YouTube IFrame API script once and calls `onReady` when it is
 * initialised (or immediately if the API is already available).
 */
function ensureYTApi(onReady: () => void): void {
  if (window.YT?.Player) {
    onReady()
    return
  }

  // Queue the callback regardless of whether the script is already loading.
  if (!window._ytApiCallbacks) window._ytApiCallbacks = []
  window._ytApiCallbacks.push(onReady)

  // Chain into any previously registered onYouTubeIframeAPIReady callback so
  // other components' players still initialise correctly.
  if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      window._ytApiCallbacks?.forEach((fn) => fn())
      window._ytApiCallbacks = []
    }
    const s = document.createElement("script")
    s.src = "https://www.youtube.com/iframe_api"
    document.head.appendChild(s)
  }
}

const YouTubeIframePlayer = React.forwardRef<
  YouTubePlayerHandle,
  YouTubeIframePlayerProps
>(({ embedUrl, title, ariaLabel, ariaDescribedBy, startTime }, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const playerRef = useRef<YTPlayerInstance | null>(null)

  // React 18 useId produces ids like ":r0:" — strip colons for a valid HTML id.
  const rawId = useId()
  const iframeId = `yt-player-${rawId.replace(/:/g, "")}`

  useImperativeHandle(ref, () => ({
    getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
  }))

  useEffect(() => {
    let destroyed = false

    ensureYTApi(() => {
      if (destroyed || !iframeRef.current || !window.YT?.Player) return
      // Wrapping an existing iframe that already has enablejsapi=1 in its src
      // does not reload the video — the API bridge is established in place.
      playerRef.current = new window.YT.Player(iframeId, {})
    })

    return () => {
      destroyed = true
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [iframeId])

  const url = new URL(embedUrl)
  url.searchParams.set("rel", "0")
  url.searchParams.set("origin", requiredEnv("NEXT_PUBLIC_ORIGIN"))
  url.searchParams.set("enablejsapi", "1")
  if (startTime && startTime > 0) {
    url.searchParams.set("start", String(Math.floor(startTime)))
  }
  const src = url.toString()

  return (
    <iframe
      id={iframeId}
      ref={iframeRef}
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
})

YouTubeIframePlayer.displayName = "YouTubeIframePlayer"
export default YouTubeIframePlayer
