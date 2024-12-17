import React from "react"
import styled from "@emotion/styled"
import { EmbedlyCard } from "../EmbedlyCard/EmbedlyCard"
import YouTubePlayer from "youtube-player"

const VideoContainer = styled.div({
  display: "flex",
  width: "100%",
  iframe: {
    borderRadius: 8,
    border: "none",
    width: "100%",
    height: "100%",
    aspectRatio: "16 / 9",
  },
})

const VideoFrame: React.FC<{
  src: string
  title: string
  aspect: number
}> = ({ src, title, aspect }) => {
  const videoPlayerRef = React.useRef<HTMLDivElement>(null)
  if (src?.startsWith("https://www.youtube.com/watch?v=")) {
    const videoId = src?.split("v=")[1]
    const videoPlayerId = `video-player-${videoId}`
    if (videoPlayerRef.current) {
      const player = YouTubePlayer(videoPlayerId)
      player.loadVideoById(videoId)
      player.getIframe().then((iframe) => {
        iframe.setAttribute("title", title)
        iframe.setAttribute(
          "allow",
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
        )
        iframe.setAttribute("referrerPolicy", "strict-origin-when-cross-origin")
        iframe.setAttribute("allowFullScreen", "")
      })
    }
    return (
      <VideoContainer>
        <div id={videoPlayerId} ref={videoPlayerRef} />
      </VideoContainer>
    )
  }
  return <EmbedlyCard aspectRatio={aspect} url={src} />
}

export default VideoFrame
