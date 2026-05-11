"use client"

import React, { useMemo } from "react"
import dynamic from "next/dynamic"
import { styled } from "ol-components"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { notFound } from "next/navigation"
import { useLearningResourcesDetail } from "api/hooks/learningResources"
import { resolveVideoSources } from "@/app-pages/VideoPlaylistCollectionPage/videoSources"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import type { VideoJsPlayerProps } from "@/app-pages/VideoPlaylistCollectionPage/VideoJsPlayer"
import type { VideoResource } from "api/v1"

const VideoJsPlayer = dynamic<VideoJsPlayerProps>(
  () => import("@/app-pages/VideoPlaylistCollectionPage/VideoJsPlayer"),
  { ssr: false },
)

const EmbedContainer = styled.div({
  position: "relative",
  width: "100vw",
  height: "100vh",
  maxHeight: "100vh",
  backgroundColor: "#000",
  overflow: "hidden",
  ".video-js, .vjs-tech": {
    width: "100% !important",
    height: "100% !important",
    position: "absolute",
    top: 0,
    left: 0,
  },
  ".vjs-big-play-button": {
    width: "92px !important",
    height: "92px !important",
    lineHeight: "92px !important",
    borderRadius: "50% !important",
    backgroundColor: "#d8daddb3 !important",
    border: "none !important",
    fontSize: "4em !important",
    marginTop: "-1.25em !important",
    marginLeft: "-1.18em !important",
  },
})

type VideoEmbedPageProps = {
  videoId: number
}

const VideoEmbedPage: React.FC<VideoEmbedPageProps> = ({ videoId }) => {
  const showVideoPlaylistPage = useFeatureFlagEnabled(
    FeatureFlags.VideoPlaylistPage,
  )
  const flagsLoaded = useFeatureFlagsLoaded()

  const { data: resource } = useLearningResourcesDetail(videoId)
  const video = resource as VideoResource | undefined

  const sources = useMemo(
    () =>
      video
        ? resolveVideoSources(
            video.video?.streaming_url,
            video.url,
            video.content_files?.[0]?.youtube_id,
          )
        : [],
    [video],
  )

  if (!showVideoPlaylistPage && flagsLoaded) {
    notFound()
  }

  if (!showVideoPlaylistPage) {
    return null
  }

  return (
    <EmbedContainer>
      <VideoJsPlayer
        key={videoId}
        sources={sources}
        tracks={video?.video?.caption_urls ?? []}
        poster={
          video?.video?.cover_image_url ?? video?.image?.url ?? undefined
        }
        autoplay={false}
        controls
        fluid={false}
      />
    </EmbedContainer>
  )
}

export default VideoEmbedPage
