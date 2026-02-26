import React, { useEffect, useRef } from "react"
import videojs from "video.js"
import type Player from "video.js/dist/types/player"
import "video.js/dist/video-js.css"

interface VideoJsPlayerProps {
  src: string
  caption?: string
}

export const VideoJsPlayer: React.FC<VideoJsPlayerProps> = ({
  src,
  caption,
}) => {
  const videoRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)

  useEffect(() => {
    // Make sure Video.js player is only initialized once
    if (!playerRef.current && videoRef.current) {
      const videoElement = document.createElement("video-js")

      videoElement.classList.add("vjs-big-play-centered")
      videoRef.current.appendChild(videoElement)

      const player = (playerRef.current = videojs(videoElement, {
        controls: true,
        responsive: true,
        fluid: true,
        preload: "auto",
        html5: {
          vhs: {
            // Enable HLS.js integration
            overrideNative: !videojs.browser.IS_SAFARI,
          },
        },
        sources: [
          {
            src,
            type: "application/x-mpegURL",
          },
        ],
      }))

      // Error handling
      player.on("error", () => {
        const error = player.error()
        console.error("Video.js error:", error)
      })
    }
  }, [src])

  // Dispose the Video.js player when the component unmounts
  useEffect(() => {
    const player = playerRef.current

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose()
        playerRef.current = null
      }
    }
  }, [])

  return (
    <div data-vjs-player style={{ width: "100%", height: "100%" }}>
      <div ref={videoRef} title={caption} />
    </div>
  )
}
