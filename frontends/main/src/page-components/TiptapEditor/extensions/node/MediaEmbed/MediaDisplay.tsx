import React from "react"
import styled from "@emotion/styled"
import { isVideoUrl, isHlsVideo } from "./lib"
import { VideoJsPlayer } from "./VideoJsPlayer"

const MediaContainer = styled.div(({ theme }) => ({
  position: "relative",
  width: "100%",
  aspectRatio: "16 / 9",
  overflow: "hidden",

  iframe: {
    width: "100%",
    height: "100%",
    borderRadius: "6px",
    display: "block",
  },

  video: {
    width: "100%",
    height: "100%",
    borderRadius: "6px",
    display: "block",
    objectFit: "contain",
    backgroundColor: "#000",
  },

  // Video.js player styling
  ".video-js": {
    width: "100%",
    height: "100%",
    borderRadius: "6px",
  },

  ".layout-full & iframe, .layout-full & video, .layout-full & .video-js": {
    borderRadius: 0,
  },
  ".ProseMirror-selectednode .layout-wide &": {
    border: `1px solid ${theme.custom.colors.red}`,
    padding: "8px",
    borderRadius: "10px",
  },
  ".ProseMirror-selectednode .layout-full &": {
    border: `1px solid ${theme.custom.colors.red}`,
    padding: "8px 0",
    borderWidth: "1px 0",
  },
}))

interface MediaDisplayProps {
  src: string
  caption?: string
}

export const MediaDisplay = ({ src, caption }: MediaDisplayProps) => {
  return (
    <MediaContainer>
      {isVideoUrl(src) ? (
        isHlsVideo(src) ? (
          <VideoJsPlayer src={src} caption={caption} />
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={src} controls title={caption}>
            Your browser does not support the video tag.
          </video>
        )
      ) : (
        <iframe src={src} frameBorder="0" allowFullScreen title={caption} />
      )}
    </MediaContainer>
  )
}
