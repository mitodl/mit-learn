"use client"

import React from "react"
import { styled } from "ol-components"
import { useLearningResourcesDetail } from "api/hooks/learningResources"
import VideoResourcePlayer from "@/app-pages/VideoPlaylistCollectionPage/VideoResourcePlayer"
import type { VideoResource } from "api/v1"

const EmbedPlayer = styled(VideoResourcePlayer)({
  width: "100vw",
  height: "100vh",
  aspectRatio: "unset",
})

type VideoEmbedPageProps = {
  videoId: number
}

const VideoEmbedPage: React.FC<VideoEmbedPageProps> = ({ videoId }) => {
  const { data: resource, isLoading } = useLearningResourcesDetail(videoId)
  const video = resource as VideoResource | undefined

  const videoTitleLabel = video?.title?.trim() || "Untitled video"

  return (
    <EmbedPlayer
      video={video}
      videoId={videoId}
      isLoading={isLoading}
      videoTitleLabel={videoTitleLabel}
      videoThumbnailAlt={`Video thumbnail for ${videoTitleLabel}`}
    />
  )
}

export default VideoEmbedPage
