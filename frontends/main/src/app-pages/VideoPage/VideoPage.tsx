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
import type {
  LearningResource,
  PaginatedLearningResourceList,
  VideoResource,
  VideoPlaylistResource,
} from "api/v1"
import { ResourceTypeEnum, VideoResourceResourceTypeEnum } from "api/v1"
import VideoPageHeader from "./VideoPageHeader"
import FeaturedVideo from "./FeaturedVideo"
import VideoCollection from "./VideoCollection"
import OtherCollections from "./OtherCollections"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"

const Page = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.lightGray1,
  minHeight: "100vh",
}))

const getResults = (
  data: PaginatedLearningResourceList | LearningResource[] | undefined,
) => {
  if (!data) {
    return []
  }
  if ("results" in data) {
    return data.results
  }
  return data
}

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

  const { data: similarData, isLoading: similarLoading } = useQuery(
    learningResourceQueries.vectorSimilar(playlistId),
  )

  if (showVideoPlaylistPage) {
    return flagsLoaded ? notFound() : null
  }
  const isLoading = playlistLoading || itemsLoading
  const videos = (items ?? []).filter(
    (item): item is VideoResource =>
      item.resource_type === VideoResourceResourceTypeEnum.Video,
  )
  const collectionVideos = videos.slice(1)

  const otherCollections = getResults(similarData).filter(
    (resource): resource is VideoPlaylistResource =>
      resource.resource_type === ResourceTypeEnum.VideoPlaylist &&
      resource.id !== playlistId,
  )

  return (
    <Page>
      <VideoPageHeader playlist={playlist} />

      {isLoading ? (
        <Skeleton variant="rectangular" width="100%" height={460} />
      ) : videos.length > 0 ? (
        <FeaturedVideo videos={videos} onPlay={navigateToVideo} />
      ) : null}

      <VideoCollection
        videos={collectionVideos}
        isLoading={isLoading}
        onPlay={navigateToVideo}
      />

      <OtherCollections
        collections={otherCollections.slice(0, 6)}
        isLoading={similarLoading}
      />
    </Page>
  )
}

export default VideoPage
