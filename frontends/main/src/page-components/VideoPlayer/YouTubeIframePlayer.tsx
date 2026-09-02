"use client"

import { requiredEnv } from "@/env"
import React, { useEffect, useImperativeHandle, useRef } from "react"

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

  useImperativeHandle(ref, () => ({
    // Before onReady the postMessage bridge isn't established so
    // getCurrentTime() can return undefined instead of a number.
    // Guard with a typeof+isFinite check so we always return a valid number.
    getCurrentTime: () => {
      if (typeof playerRef.current?.getCurrentTime !== "function") return 0
      try {
        const t = playerRef.current.getCurrentTime()
        return typeof t === "number" && isFinite(t) && t >= 0 ? t : 0
      } catch {
        return 0
      }
    },
  }))

  useEffect(() => {
    let destroyed = false
    const iframe = iframeRef.current
    if (!iframe) return

    const createPlayer = () => {
      // Guard against double-creation (load event + fallback timer both firing).
      if (destroyed || playerRef.current) return
      ensureYTApi(() => {
        if (destroyed || playerRef.current || !iframeRef.current) return
        if (!window.YT?.Player) return
        // Pass the element reference directly rather than an id string so
        // YT.Player tracks this specific element; an id string would cause
        // document.getElementById lookup at cleanup time and could match a
        // newly-mounted iframe sharing the same position-based id.
        playerRef.current = new window.YT.Player(iframeRef.current, {})
      })
    }

    // Wrap the iframe with YT.Player only AFTER its embedded player has loaded.
    // Wrapping a not-yet-loaded iframe leaves the postMessage bridge — and so
    // getCurrentTime() — permanently disconnected. On the first page load the
    // YT API script fetch naturally delays us past the iframe load, but on
    // client-side navigation window.YT already exists, so without this guard we
    // would wrap the brand-new iframe synchronously, before its content loads.
    iframe.addEventListener("load", createPlayer)
    // Fallback for an iframe that already finished loading before this effect
    // attached the listener (e.g. a server-rendered iframe after hydration),
    // where the load event will not fire again. No-op once createPlayer's guard
    // wins via the load event on the navigation path.
    const fallbackTimer = setTimeout(createPlayer, 1500)

    return () => {
      destroyed = true
      clearTimeout(fallbackTimer)
      iframe.removeEventListener("load", createPlayer)
      // Do NOT call playerRef.current?.destroy() here.
      // YT.Player.destroy() removes the iframe element from the DOM. In React 18
      // Strict Mode (and during key-based remounts), this fires before the next
      // effect runs, leaving iframeRef.current pointing to a detached element so
      // the new YT.Player call silently fails. React owns the iframe's DOM
      // lifecycle — when it removes the element, the browser terminates the
      // embedded player automatically.
      playerRef.current = null
    }
  }, [])

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
