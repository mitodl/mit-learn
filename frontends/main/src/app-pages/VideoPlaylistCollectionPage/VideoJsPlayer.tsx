"use client"

import React, { useEffect, useRef } from "react"
import videojs from "video.js"
import Player from "video.js/dist/types/player"
import "video.js/dist/video-js.css"
// Register YouTube tech so video.js can play youtube:// sources
import "videojs-youtube"
import type { CaptionUrl } from "api/v1"

export type VideoJsSource = {
  src: string
  type: string
}

export type VideoJsPlayerProps = {
  sources: VideoJsSource[]
  tracks?: CaptionUrl[]
  poster?: string | null
  autoplay?: boolean
  controls?: boolean
  fluid?: boolean
  ariaLabel?: string
  ariaDescribedBy?: string
  onReady?: (player: Player) => void
}

/**
 * A React wrapper around video.js.
 * Initialises the player once on mount and disposes it on unmount.
 */
const VideoJsPlayer: React.FC<VideoJsPlayerProps> = ({
  sources,
  tracks = [],
  poster,
  autoplay = true,
  controls = true,
  fluid = true,
  ariaLabel,
  ariaDescribedBy,
  onReady,
}) => {
  const videoRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)
  // Prevent the update effect from running on the very first mount —
  // the init effect already handles the initial sources/tracks setup.
  const isMountedRef = useRef(false)

  const addTracks = (player: Player, trackList: CaptionUrl[]) => {
    // Remove any existing remote text tracks first
    const existing = player.remoteTextTracks()
    for (let i = existing.length - 1; i >= 0; i--) {
      // TextTrackList is array-like at runtime but lacks an index signature in types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      player.removeRemoteTextTrack((existing as any)[i])
    }
    trackList.forEach((track, index) => {
      player.addRemoteTextTrack(
        {
          kind: "captions",
          src: track.url,
          srclang: track.language,
          label: track.language_name || track.language,
          default: index === 0,
        },
        false,
      )
    })
  }

  useEffect(() => {
    // Only initialise once
    if (playerRef.current) return

    const videoEl = document.createElement("video-js")
    videoEl.classList.add("vjs-big-play-centered")
    if (ariaLabel) {
      videoEl.setAttribute("aria-label", ariaLabel)
    }
    if (ariaDescribedBy) {
      videoEl.setAttribute("aria-describedby", ariaDescribedBy)
    }
    videoEl.style.width = "100%"
    videoEl.style.height = "100%"
    videoRef.current!.appendChild(videoEl)

    const player = videojs(
      videoEl,
      {
        autoplay,
        controls,
        fluid,
        fill: !fluid,
        responsive: true,
        poster: poster ?? undefined,
        sources,
        techOrder: ["youtube", "html5"],
        // Always set crossOrigin so the browser can fetch VTT files from
        // a different origin (e.g. CloudFront CDN) without CORS errors.
        crossOrigin: "anonymous",
      },
      function (this: Player) {
        // Add tracks inside the ready callback — this is the earliest safe
        // point; adding them before ready can silently fail on some browsers.
        addTracks(this, tracks)
        onReady?.(this)
      },
    )

    playerRef.current = player
    isMountedRef.current = true
  }, [
    ariaDescribedBy,
    ariaLabel,
    autoplay,
    controls,
    fluid,
    onReady,
    poster,
    sources,
    tracks,
  ])

  // Update sources / poster / tracks when props change without re-creating the player.
  // Skip on first mount — the init effect's ready callback already handled it.
  useEffect(() => {
    const player = playerRef.current
    if (!player || !isMountedRef.current) return
    player.src(sources)
    player.poster(poster ?? "")
    addTracks(player, tracks)
  }, [sources, poster, tracks])

  // Dispose on unmount
  useEffect(() => {
    return () => {
      const player = playerRef.current
      if (player && !player.isDisposed()) {
        player.dispose()
        playerRef.current = null
      }
    }
  }, [])

  return (
    <div data-vjs-player style={{ width: "100%", height: "100%" }}>
      <div ref={videoRef} style={{ width: "100%", height: "100%" }} />
    </div>
  )
}

export default VideoJsPlayer

// Re-export for backward compatibility — the implementation lives in
// videoSources.ts so it can be imported without pulling in video.js.
export { resolveVideoSources } from "./videoSources"
