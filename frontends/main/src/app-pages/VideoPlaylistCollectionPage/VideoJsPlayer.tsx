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
    // Remove any existing remote text tracks first.
    // Snapshot into a plain array before mutating (TextTrackList is live).
    // video.js's TextTrackList TS type lacks a numeric index signature, so
    // cast via unknown to a Record — safer than `any` and no eslint-disable needed.
    type TrackArg = Parameters<typeof player.removeRemoteTextTrack>[0]
    const existing = player.remoteTextTracks()
    const snapshot = Array.from(
      { length: existing.length },
      (_, i) => (existing as unknown as Record<number, TrackArg>)[i],
    )
    snapshot.forEach((t) => player.removeRemoteTextTrack(t))
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
        // Set the flag here so the update effect only runs after the player
        // is truly ready and the initial setup is complete.
        isMountedRef.current = true
      },
    )

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

  // Update sources / poster when they change without re-creating the player.
  // Kept separate from the tracks effect so a captions-only change does not
  // call player.src() and unexpectedly reload / interrupt playback.
  useEffect(() => {
    const player = playerRef.current
    if (!player || !isMountedRef.current) return
    player.ready(() => {
      player.src(sources)
      player.poster(poster ?? "")
    })
  }, [sources, poster])

  // Update tracks independently so caption changes never trigger a media reload.
  useEffect(() => {
    const player = playerRef.current
    if (!player || !isMountedRef.current) return
    player.ready(() => {
      addTracks(player, tracks)
    })
  }, [tracks])

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
