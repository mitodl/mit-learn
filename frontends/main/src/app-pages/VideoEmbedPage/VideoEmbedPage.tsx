"use client"

import React from "react"
import { styled } from "ol-components"
import VideoResourcePlayer from "@/app-pages/VideoPlaylistCollectionPage/VideoResourcePlayer"
import type { VideoResource } from "api/v1"

const EmbedPlayer = styled(VideoResourcePlayer)({
  width: "100vw",
  height: "100vh",
  aspectRatio: "unset",
})

type VideoEmbedPageProps = {
  videoResource: VideoResource
}

const VideoEmbedPage: React.FC<VideoEmbedPageProps> = ({ videoResource }) => {
  const videoTitleLabel = videoResource.title?.trim() || "Untitled video"

  return (
    <EmbedPlayer
      video={videoResource}
      videoId={videoResource.id}
      isLoading={false}
      videoTitleLabel={videoTitleLabel}
      videoThumbnailAlt={`Video thumbnail for ${videoTitleLabel}`}
    />
  )
}

export default VideoEmbedPage
