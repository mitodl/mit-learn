"use client"

import React, { useCallback } from "react"
import { styled, Skeleton } from "ol-components"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { notFound } from "next/navigation"
import { useRouter } from "next-nprogress-bar"
import { useQuery } from "@tanstack/react-query"
import {
  learningResourceQueries,
  videoPlaylistQueries,
} from "api/hooks/learningResources"
import type { VideoResource, VideoPlaylistResource } from "api/v1"
import { VideoResourceResourceTypeEnum } from "api/v1"
import VideoPageHeader from "./VideoPageHeader"
import FeaturedVideo from "./FeaturedVideo"
import VideoCollection from "./VideoCollection"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"

const Page = styled.div({
  backgroundColor: "#fff",
  minHeight: "100vh",
})

type VideoPageProps = {
  playlistId: number
}

const VideoPage: React.FC<VideoPageProps> = ({ playlistId }) => {
  const router = useRouter()

  const navigateToVideo = useCallback(
    (resource: VideoResource) => {
      router.push(`/playlist/detail/${resource.id}?playlist=${playlistId}`)
    },
    [router, playlistId],
  )

  const showVideoPlaylistPage = useFeatureFlagEnabled(
    FeatureFlags.VideoPlaylistPage,
  )
  const flagsLoaded = useFeatureFlagsLoaded()

  const { data: playlistData, isLoading: playlistLoading } = useQuery(
    videoPlaylistQueries.detail(playlistId),
  )
  const playlist = playlistData as VideoPlaylistResource | undefined

  const { data: items, isLoading: itemsLoading } = useQuery(
    learningResourceQueries.items(playlistId, {
      learning_resource_id: playlistId,
    }),
  )

  if (!showVideoPlaylistPage) {
    return flagsLoaded ? notFound() : null
  }
  const isLoading = playlistLoading || itemsLoading
  const videos = (items ?? []).filter(
    (item): item is VideoResource =>
      item.resource_type === VideoResourceResourceTypeEnum.Video,
  )
  const featuredVideo = videos[0] ?? null
  const collectionVideos = videos.slice(1)

  return (
    <Page>
      <VideoPageHeader playlist={playlist} />

      {isLoading ? (
        <Skeleton variant="rectangular" width="100%" height={460} />
      ) : featuredVideo ? (
        <FeaturedVideo video={featuredVideo} onPlay={navigateToVideo} />
      ) : null}

      <VideoCollection
        videos={collectionVideos}
        isLoading={isLoading}
        onPlay={navigateToVideo}
      />
    </Page>
  )
}

export default VideoPage
