import React, { useEffect, useRef, useState } from "react"
import videojs from "video.js"
import type Player from "video.js/dist/types/player"
import "video.js/dist/video-js.css"

interface VideoJsPlayerProps {
  src: string
  caption?: string
}

const getVideoType = (url: string): string => {
  const lowerUrl = url.toLowerCase()
  if (lowerUrl.endsWith(".m3u8")) {
    return "application/x-mpegURL"
  }
  if (lowerUrl.endsWith(".mp4")) {
    return "video/mp4"
  }
  // Default to mp4 for other cases
  return "video/mp4"
}

const deriveMediaUrls = (
  m3u8Url: string,
): { subtitlesUrl: string; posterUrl: string } | null => {
  try {
    // Extract directory and filename
    const lastSlashIndex = m3u8Url.lastIndexOf("/")
    if (lastSlashIndex === -1) return null

    const directory = m3u8Url.substring(0, lastSlashIndex)
    const filename = m3u8Url.substring(lastSlashIndex + 1)

    // Extract base name (remove .5M.m3u8 or similar pattern)
    // Pattern: video_HLS1.5M.m3u8 -> video_HLS1
    const baseMatch = filename.match(/^(.+?)(?:\.\d+[MK])?\.m3u8$/)
    if (!baseMatch) return null

    const baseName = baseMatch[1]

    return {
      subtitlesUrl: `${directory}/${baseName}.srt`,
      posterUrl: `${directory}/${baseName}_cover.jpeg`,
    }
  } catch {
    return null
  }
}

const checkUrlExists = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: "HEAD" })
    return response.ok
  } catch {
    return false
  }
}

export const VideoJsPlayer: React.FC<VideoJsPlayerProps> = ({
  src,
  caption,
}) => {
  const videoRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)
  const [posterUrl, setPosterUrl] = useState<string | undefined>()
  const [subtitlesUrl, setSubtitlesUrl] = useState<string | undefined>()

  // Check for related media files (poster and subtitles) for m3u8 videos
  useEffect(() => {
    const loadRelatedMedia = async () => {
      if (!src.toLowerCase().endsWith(".m3u8")) {
        return
      }

      const derivedUrls = deriveMediaUrls(src)
      if (!derivedUrls) return
      console.log("Derived URLs:", derivedUrls)
      // Check if poster exists
      const posterExists = await checkUrlExists(derivedUrls.posterUrl)
      if (posterExists) {
        setPosterUrl(derivedUrls.posterUrl)
      }

      // Check if subtitles exist
      const subtitlesExist = await checkUrlExists(derivedUrls.subtitlesUrl)
      if (subtitlesExist) {
        setSubtitlesUrl(derivedUrls.subtitlesUrl)
      }
    }

    loadRelatedMedia()
  }, [src])

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
        aspectRatio: "16:9",
        preload: "auto",
        poster: posterUrl,
        html5: {
          vhs: {
            // Enable HLS.js integration
            overrideNative: !videojs.browser.IS_SAFARI,
          },
        },
        sources: [
          {
            src,
            type: getVideoType(src),
          },
        ],
      }))

      // Add subtitles track if available
      if (subtitlesUrl) {
        player.addRemoteTextTrack(
          {
            kind: "captions",
            src: subtitlesUrl,
            srclang: "en",
            label: "English",
            default: true,
          },
          false,
        )
      }

      // Error handling
      player.on("error", () => {
        const error = player.error()
        console.error("Video.js error:", error)
      })
    }
  }, [src, posterUrl, subtitlesUrl])

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
