"use client"

import React from "react"
import { styled, Skeleton, Typography } from "ol-components"
import { Button } from "@mitodl/smoot-design"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { notFound } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  learningResourceQueries,
  videoPlaylistQueries,
  useInfiniteLearningResourceItems,
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

const ShowMoreContainer = styled("div")({
  width: "100%",
  display: "flex",
  justifyContent: "center",
})

const ShowMoreButton = styled(Button)(({ theme }) => ({
  minWidth: "140px",
  margin: "40px 0 0px 0",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}))

const VIDEOS_PAGE_SIZE = 10
type VideoPlaylistCollectionPageProps = {
  playlistId: number
}

const VideoPlaylistCollectionPage: React.FC<
  VideoPlaylistCollectionPageProps
> = ({ playlistId }) => {
  const getVideoHref = (resource: VideoResource) =>
    `/video/${resource.id}?playlist=${playlistId}`

  const showVideoPlaylistPage = useFeatureFlagEnabled(
    FeatureFlags.VideoPlaylistPage,
  )
  const flagsLoaded = useFeatureFlagsLoaded()

  const {
    data: playlist,
    isLoading: playlistLoading,
    isError,
  } = useQuery(videoPlaylistQueries.detail(playlistId))

  const {
    data: itemsData,
    isLoading: itemsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteLearningResourceItems(playlistId, {
    learning_resource_id: playlistId,
    limit: VIDEOS_PAGE_SIZE,
  })
  console.log("itemsData", itemsData)
  const { data: similarData, isLoading: similarLoading } = useQuery({
    ...learningResourceQueries.vectorSimilar({
      id: playlistId,
      limit: 6,
      resource_type: [ResourceTypeEnum.VideoPlaylist],
    }),
  })

  if (showVideoPlaylistPage) {
    return flagsLoaded ? notFound() : null
  }

  if (isError) {
    return notFound()
  }
  const isLoading = playlistLoading || itemsLoading
  const totalCount = itemsData?.pages[0]?.count ?? 0
  const videos = (
    itemsData?.pages.flatMap((page) =>
      page.results.map((rel) => rel.resource),
    ) ?? []
  ).filter(
    (item): item is VideoResource =>
      item.resource_type === VideoResourceResourceTypeEnum.Video,
  )
  const playlistType = isOcwPlaylist(playlist)

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
      <VideoPageHeader
        playlist={playlist}
        isSeries={playlistType}
        totalVideos={totalCount}
      />

      {isLoading ? (
        <Skeleton variant="rectangular" width="100%" height={460} />
      ) : videos.length > 0 ? (
        <FeaturedVideo
          video={videos[0]}
          href={getVideoHref(videos[0])}
          isSeries={playlistType}
          totalVideos={totalCount}
          totalTime={totalTime}
        />
      ) : null}
      {!playlistType && (
        <VideoCollection
          videos={videos.slice(1)} // 0th video is featured prominently
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
      {hasNextPage && (
        <ShowMoreContainer>
          <ShowMoreButton
            variant="secondary"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading..." : "Load more videos"}
          </ShowMoreButton>
        </ShowMoreContainer>
      )}
      {!itemsLoading && videos.length === 0 && (
        <Typography variant="body1" color="text.secondary">
          No videos found.
        </Typography>
      )}
      <RelatedPlaylist
        collections={otherCollections}
        isLoading={similarLoading}
      />
    </Page>
  )
}

export default VideoPlaylistCollectionPage
