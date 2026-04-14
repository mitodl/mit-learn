"use client"

import React from "react"
import { styled, Skeleton } from "ol-components"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { notFound } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  learningResourceQueries,
  videoPlaylistQueries,
} from "api/hooks/learningResources"
import type { VideoResource, VideoPlaylistResource } from "api/v1"
import { ResourceTypeEnum, VideoResourceResourceTypeEnum } from "api/v1"
import VideoPageHeader from "./VideoPageHeader"
import FeaturedVideo from "./FeaturedVideo"
import VideoCollection from "./VideoCollection"
import RelatedPlaylist from "./RelatedPlaylist"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"

const Page = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.lightGray1,
  minHeight: "100vh",
}))

type VideoPlaylistCollectionPageProps = {
  playlistId: number
}

const VideoPlaylistCollectionPage: React.FC<
  VideoPlaylistCollectionPageProps
> = ({ playlistId }) => {
  const getVideoHref = (resource: VideoResource) =>
    `/video-playlist/detail/${resource.id}?playlist=${playlistId}`

  const showVideoPlaylistPage = useFeatureFlagEnabled(
    FeatureFlags.VideoPlaylistPage,
  )
  const flagsLoaded = useFeatureFlagsLoaded()

  const {
    data: playlist,
    isLoading: playlistLoading,
    isError,
  } = useQuery(videoPlaylistQueries.detail(playlistId))

  const { data: items, isLoading: itemsLoading } = useQuery(
    learningResourceQueries.items(playlistId, {
      learning_resource_id: playlistId,
    }),
  )

  const { data: similarData, isLoading: similarLoading } = useQuery({
    ...learningResourceQueries.vectorSimilar(playlistId),
    select: (data) =>
      data.filter(
        (resource) => resource.resource_type === ResourceTypeEnum.VideoPlaylist,
      ),
  })

  if (!showVideoPlaylistPage) {
    return flagsLoaded ? notFound() : null
  }

  if (isError) {
    return notFound()
  }
  const isLoading = playlistLoading || itemsLoading
  const videos = (items ?? []).filter(
    (item): item is VideoResource =>
      item.resource_type === VideoResourceResourceTypeEnum.Video,
  )
  const collectionVideos = videos.slice(1)

  const otherCollections = ((similarData ?? []) as VideoPlaylistResource[])
    .filter((resource) => resource.id !== playlistId)
    .slice(0, 6)

  return (
    <Page>
      <VideoPageHeader playlist={playlist} />

      {isLoading ? (
        <Skeleton variant="rectangular" width="100%" height={460} />
      ) : videos.length > 0 ? (
        <FeaturedVideo video={videos[0]} href={getVideoHref(videos[0])} />
      ) : null}

      <VideoCollection
        videos={collectionVideos}
        isLoading={isLoading}
        getHref={getVideoHref}
      />

      <RelatedPlaylist
        collections={otherCollections}
        isLoading={similarLoading}
      />
    </Page>
  )
}

export default VideoPlaylistCollectionPage
