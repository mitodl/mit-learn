import React from "react"
import styled from "@emotion/styled"
import { EmbedlyCard } from "../EmbedlyCard/EmbedlyCard"

const IFrame = styled.iframe`
  border-radius: 8px;
  border: none;
  width: 100%;
  aspect-ratio: 16 / 9;
`

const VideoFrame: React.FC<{
  src: string
  title: string
  aspect: number
}> = ({ src, title, aspect }) => {
  if (src?.startsWith("https://www.youtube.com/watch?v=")) {
    const videoId = src?.split("v=")[1]
    return (
      <IFrame
        src={`https://www.youtube.com/embed/${videoId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    )
  }
  return <EmbedlyCard aspectRatio={aspect} url={src} />
}

export default VideoFrame
