"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { Breadcrumbs, useMediaQuery } from "ol-components"
import type { Theme } from "ol-components"
import { useLearningResourcesList } from "api/hooks/learningResources"
import { useInfiniteLearningPathItems } from "api/hooks/learningPaths"
import { ResourceTypeEnum, LearningResourcesListSortbyEnum } from "api/v1"
import type { LearningResource } from "api/v1"
import { env } from "@/env"
import { HOME } from "@/common/urls"
import PodcastContainer from "../PodcastContainer"
import PodcastPlayer, { PLAYER_HEIGHT } from "../PodcastPlayer"
import type { PodcastTrack, PodcastPlayerHandle } from "../PodcastPlayer"
import {
  PageSection,
  BreadcrumbBar,
  StyledPodcastContainer,
  SectionDivider,
} from "./styled"
import HeroSection from "./HeroSection"
import NowPlayingSection from "./NowPlayingSection"
import LatestEpisodesSection from "./LatestEpisodesSection"
import PodcastSeriesSection from "./PodcastSeriesSection"
import { getEpisodeAudioUrl } from "./helpers"
import {
  EPISODES_PAGE_SIZE,
  SERIES_FEATURED_COUNT,
  SERIES_MORE_COUNT,
} from "./constants"

export const PodcastsListingPage: React.FC = () => {
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"))
  const [playingEpisode, setPlayingEpisode] = useState<LearningResource | null>(
    null,
  )
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const playerRef = useRef<PodcastPlayerHandle>(null)
  const episodesLimit = EPISODES_PAGE_SIZE + 1
  const seriesLimit = SERIES_MORE_COUNT

  const { data: episodesData } = useLearningResourcesList({
    resource_type: [ResourceTypeEnum.PodcastEpisode],
    sortby: LearningResourcesListSortbyEnum.New,
    limit: episodesLimit,
  })

  const { data: seriesData } = useLearningResourcesList({
    resource_type: [ResourceTypeEnum.Podcast],
    sortby: LearningResourcesListSortbyEnum.New,
    limit: seriesLimit,
  })

  const featuredLearningPathId = Number(
    env("NEXT_PUBLIC_PODCASTS_FEATURED_LIST_LEARNINGPATH_ID"),
  )
  const hasFeaturedLearningPathId =
    Number.isFinite(featuredLearningPathId) && featuredLearningPathId > 0

  const { data: featuredPodcastsData } = useInfiniteLearningPathItems(
    {
      learning_resource_id: featuredLearningPathId,
      limit: SERIES_FEATURED_COUNT,
    },
    { enabled: hasFeaturedLearningPathId },
  )

  const episodes = episodesData?.results ?? []
  const totalEpisodes = episodesData?.count ?? 0
  const nowPlaying = episodes[0]
  const latestEpisodes = episodes.slice(1)
  const hasMoreEpisodes = episodes.length < totalEpisodes

  const featuredSeries = useMemo(() => {
    const items =
      featuredPodcastsData?.pages.flatMap((page) => page.results ?? []) ?? []
    return items
      .map((item) => item.resource)
      .filter(
        (resource): resource is LearningResource =>
          resource?.resource_type === ResourceTypeEnum.Podcast,
      )
      .slice(0, SERIES_FEATURED_COUNT)
  }, [featuredPodcastsData])

  const series = seriesData?.results ?? []
  const totalSeries = seriesData?.count ?? 0
  const moreSeries = series
  const hasMoreSeries = series.length < totalSeries

  const handlePlayClick = (episode: LearningResource) => {
    if (!getEpisodeAudioUrl(episode)) return
    if (playingEpisode?.id === episode.id) {
      playerRef.current?.resume()
    } else {
      setPlayingEpisode(episode)
    }
  }

  const handlePauseClick = () => playerRef.current?.pause()

  const currentTrack: PodcastTrack | null = playingEpisode
    ? (() => {
        const audioUrl = getEpisodeAudioUrl(playingEpisode)
        if (!audioUrl) return null
        return {
          audioUrl,
          title: playingEpisode.title || "Untitled Episode",
          podcastName: playingEpisode.offered_by?.name || "Podcast",
        }
      })()
    : null

  useEffect(() => {
    const root = document.documentElement
    if (currentTrack) {
      const height = isMobile ? PLAYER_HEIGHT.mobile : PLAYER_HEIGHT.desktop
      root.style.setProperty("--mit-player-height", `${height}px`)
    } else {
      root.style.removeProperty("--mit-player-height")
    }
    return () => {
      root.style.removeProperty("--mit-player-height")
    }
  }, [currentTrack, isMobile])

  const nowPlayingIsPlaying =
    !!nowPlaying && playingEpisode?.id === nowPlaying.id && isAudioPlaying

  return (
    <>
      <PageSection>
        <BreadcrumbBar>
          <StyledPodcastContainer>
            <Breadcrumbs
              variant="light"
              ancestors={[{ href: HOME, label: "Home" }]}
              current="Podcasts"
            />
          </StyledPodcastContainer>
        </BreadcrumbBar>

        <HeroSection totalSeries={totalSeries} totalEpisodes={totalEpisodes} />

        <SectionDivider />

        <PodcastContainer>
          <NowPlayingSection
            nowPlaying={nowPlaying}
            isPlaying={nowPlayingIsPlaying}
            onPlayClick={handlePlayClick}
            onPauseClick={handlePauseClick}
          />

          <LatestEpisodesSection
            episodes={latestEpisodes}
            isMobile={isMobile}
            playingEpisodeId={playingEpisode?.id}
            isAudioPlaying={isAudioPlaying}
            onPlayClick={handlePlayClick}
            onPauseClick={handlePauseClick}
            hasMoreEpisodes={hasMoreEpisodes}
            isPlayable={(episode) => Boolean(getEpisodeAudioUrl(episode))}
          />

          <PodcastSeriesSection
            featuredSeries={featuredSeries}
            moreSeries={moreSeries}
            hasMoreSeries={hasMoreSeries}
            totalSeries={totalSeries}
            isMobile={isMobile}
          />
        </PodcastContainer>
      </PageSection>
      {currentTrack && (
        <PodcastPlayer
          ref={playerRef}
          track={currentTrack}
          onClose={() => setPlayingEpisode(null)}
          onPlayStateChange={setIsAudioPlaying}
        />
      )}
    </>
  )
}

export default PodcastsListingPage
