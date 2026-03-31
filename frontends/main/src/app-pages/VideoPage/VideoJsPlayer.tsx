"use client"

import React, { useEffect, useRef } from "react"
import videojs from "video.js"
import Player from "video.js/dist/types/player"
import "video.js/dist/video-js.css"
// Register YouTube tech so video.js can play youtube:// sources
import "videojs-youtube"

export type VideoJsSource = {
  src: string
  type: string
}

export type VideoJsPlayerProps = {
  sources: VideoJsSource[]
  poster?: string | null
  autoplay?: boolean
  controls?: boolean
  fluid?: boolean
  onReady?: (player: Player) => void
}

/**
 * A React wrapper around video.js.
 * Initialises the player once on mount and disposes it on unmount.
 */
const VideoJsPlayer: React.FC<VideoJsPlayerProps> = ({
  sources,
  poster,
  autoplay = true,
  controls = true,
  fluid = true,
  onReady,
}) => {
  const videoRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)

  useEffect(() => {
    // Only initialise once
    if (playerRef.current) return

    const videoEl = document.createElement("video-js")
    videoEl.classList.add("vjs-big-play-centered")
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

    playerRef.current = player
  }, [autoplay, controls, fluid, onReady, poster, sources])

  // Update sources / poster when props change without re-creating the player
  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    player.src(sources)
    if (poster) player.poster(poster)
  }, [sources, poster])

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
