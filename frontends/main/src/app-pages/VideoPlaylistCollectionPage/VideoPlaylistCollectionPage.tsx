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
import { formatDurationHuman } from "ol-utilities"
import { isOcwPlaylist } from "@/common/utils"
import type { VideoResource, VideoPlaylistResource } from "api/v1"
import { ResourceTypeEnum, VideoResourceResourceTypeEnum } from "api/v1"
import { EpisodeItem } from "./SeriesVideoList"
import VideoPageHeader from "./VideoPageHeader"
import FeaturedVideo from "./FeaturedVideo"
import VideoCollection from "./VideoCollection"
import RelatedPlaylist from "./RelatedPlaylist"
import VideoContainer from "./VideoContainer"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"

const Page = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.lightGray1,
  minHeight: "100vh",
}))

const EpisodeListSection = styled.section(({ theme }) => ({
  backgroundColor: theme.custom.colors.lightGray1,
}))

const EpisodeListContainer = styled(VideoContainer)(({ theme }) => ({
  [theme.breakpoints.up("sm")]: {
    padding: "0 48px !important",
  },
}))
const EpisodeListUl = styled.ul({
  listStyle: "none",
  margin: 0,
  padding: 0,
})
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
  const playlistType = isOcwPlaylist(playlist)

  const totalVideos = videos.length
  const totalVideoSeconds = videos.reduce((acc, video) => {
    const duration = video.video?.duration ?? ""
    const match = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(duration)
    if (!match) return acc
    return (
      acc +
      parseInt(match[1] ?? "0") * 3600 +
      parseInt(match[2] ?? "0") * 60 +
      parseInt(match[3] ?? "0")
    )
  }, 0)
  const totalTime = formatDurationHuman(
    `PT${Math.floor(totalVideoSeconds / 3600)}H${Math.floor((totalVideoSeconds % 3600) / 60)}M${totalVideoSeconds % 60}S`,
  )

  const otherCollections = ((similarData ?? []) as VideoPlaylistResource[])
    .filter((resource) => resource.id !== playlistId)
    .slice(0, 6)

  return (
    <Page>
      <VideoPageHeader playlist={playlist} isSeries={playlistType} />

      {isLoading ? (
        <Skeleton variant="rectangular" width="100%" height={460} />
      ) : videos.length > 0 ? (
        <FeaturedVideo
          video={videos[0]}
          href={getVideoHref(videos[0])}
          isSeries={playlistType}
          totalVideos={totalVideos}
          totalTime={totalTime}
        />
      ) : null}
      {!playlistType && (
        <VideoCollection
          videos={collectionVideos}
          isLoading={isLoading}
          getHref={getVideoHref}
        />
      )}
      {playlistType && (
        <EpisodeListSection>
          <EpisodeListContainer>
            <EpisodeListUl>
              {videos.map((video, i) => (
                <EpisodeItem
                  key={video.id}
                  episode={video}
                  href={getVideoHref(video)}
                  index={i + 1}
                />
              ))}
            </EpisodeListUl>
          </EpisodeListContainer>
        </EpisodeListSection>
      )}
      <RelatedPlaylist
        collections={otherCollections}
        isLoading={similarLoading}
      />
    </Page>
  )
}

export default VideoPlaylistCollectionPage
