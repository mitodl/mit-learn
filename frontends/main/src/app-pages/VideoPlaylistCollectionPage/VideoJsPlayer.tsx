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
      },
      function (this: Player) {
        onReady?.(this)
      },
    )

    tracks.forEach((track, index) => {
      player.addRemoteTextTrack(
        {
          kind: "captions",
          src: track.url,
          srclang: track.language,
          label: track.language_name || track.language,
          // Auto-show the first caption track so hearing-impaired / muted users
          // see captions without needing to manually enable them.
          default: index === 0,
        },
        false,
      )
    })

    playerRef.current = player
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

  // Update sources / poster / tracks when props change without re-creating the player
  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    player.src(sources)
    player.poster(poster ?? "")

    // Remove existing remote text tracks then re-add
    const existingTracks = player.remoteTextTracks()
    for (let i = existingTracks.length - 1; i >= 0; i--) {
      // TextTrackList is array-like at runtime but lacks an index signature in types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      player.removeRemoteTextTrack((existingTracks as any)[i])
    }
    tracks.forEach((track, index) => {
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
