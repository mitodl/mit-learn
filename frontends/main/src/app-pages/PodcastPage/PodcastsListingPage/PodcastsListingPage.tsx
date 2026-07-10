"use client"

import React, { useMemo, useRef } from "react"
import { Breadcrumbs, useMediaQuery } from "ol-components"
import type { Theme } from "ol-components"
import { useLearningResourcesList } from "api/hooks/learningResources"
import { useInfiniteLearningPathItems } from "api/hooks/learningPaths"
import { ResourceTypeEnum, LearningResourcesListSortbyEnum } from "api/v1"
import type { LearningResource } from "api/v1"
import { env } from "@/env"
import { HOME } from "@/common/urls"
import PodcastContainer from "../PodcastContainer"
import PodcastPlayer from "../PodcastPlayer"
import type { PodcastPlayerHandle } from "../PodcastPlayer"
import { usePodcastPlayer } from "../usePodcastPlayer"
import {
  PageSection,
  BreadcrumbBar,
  StyledPodcastContainer,
  SectionDivider,
} from "./styled"
import HeroSection from "./HeroSection"
import NowPlayingSection from "./NowPlayingSection"
import LatestEpisodesSection from "./LatestEpisodesSection"
import PodcastSection from "./PodcastSection"
import { getEpisodeAudioUrl } from "./helpers"
import {
  EPISODES_PAGE_SIZE,
  PODCAST_FEATURED_COUNT,
  PODCAST_MORE_COUNT,
} from "./constants"

export const PodcastsListingPage: React.FC = () => {
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"))
  const playerRef = useRef<PodcastPlayerHandle>(null)
  const {
    playingEpisode,
    isAudioPlaying,
    setIsAudioPlaying,
    currentTrack,
    toggle,
    pause,
    close,
  } = usePodcastPlayer(playerRef, isMobile)
  const episodesLimit = EPISODES_PAGE_SIZE + 1
  const podcastLimit = PODCAST_MORE_COUNT

  const { data: episodesData } = useLearningResourcesList({
    resource_type: [ResourceTypeEnum.PodcastEpisode],
    sortby: LearningResourcesListSortbyEnum.New,
    limit: episodesLimit,
  })

  const { data: podcastData } = useLearningResourcesList({
    resource_type: [ResourceTypeEnum.Podcast],
    sortby: LearningResourcesListSortbyEnum.New,
    limit: podcastLimit,
  })

  const featuredLearningPathId = Number(
    env("NEXT_PUBLIC_PODCASTS_FEATURED_LIST_LEARNINGPATH_ID"),
  )
  const hasFeaturedLearningPathId =
    Number.isFinite(featuredLearningPathId) && featuredLearningPathId > 0

  const { data: featuredPodcastsData } = useInfiniteLearningPathItems(
    {
      learning_resource_id: featuredLearningPathId,
      limit: PODCAST_FEATURED_COUNT,
    },
    { enabled: hasFeaturedLearningPathId },
  )

  const episodes = episodesData?.results ?? []
  const totalEpisodes = episodesData?.count ?? 0
  const nowPlaying = episodes[0]
  const latestEpisodes = episodes.slice(1)
  const hasMoreEpisodes = episodes.length < totalEpisodes

  const featuredPodcasts = useMemo(() => {
    const items =
      featuredPodcastsData?.pages.flatMap((page) => page.results ?? []) ?? []
    return items
      .map((item) => item.resource)
      .filter(
        (resource): resource is LearningResource =>
          resource?.resource_type === ResourceTypeEnum.Podcast,
      )
      .slice(0, PODCAST_FEATURED_COUNT)
  }, [featuredPodcastsData])

  const podcasts = podcastData?.results ?? []
  const totalPodcasts = podcastData?.count ?? 0
  const morePodcasts = podcasts
  const hasMorePodcasts = podcasts.length < totalPodcasts

  const handlePlayClick = (episode: LearningResource) => toggle(episode)

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

        <HeroSection
          totalPodcasts={totalPodcasts}
          totalEpisodes={totalEpisodes}
        />

        <SectionDivider />

        <PodcastContainer>
          <NowPlayingSection
            nowPlaying={nowPlaying}
            isPlaying={nowPlayingIsPlaying}
            onPlayClick={handlePlayClick}
            onPauseClick={pause}
          />

          <LatestEpisodesSection
            episodes={latestEpisodes}
            isMobile={isMobile}
            playingEpisodeId={playingEpisode?.id}
            isAudioPlaying={isAudioPlaying}
            onPlayClick={handlePlayClick}
            onPauseClick={pause}
            hasMoreEpisodes={hasMoreEpisodes}
            isPlayable={(episode) => Boolean(getEpisodeAudioUrl(episode))}
          />

          <PodcastSection
            featuredPodcasts={featuredPodcasts}
            morePodcasts={morePodcasts}
            hasMorePodcasts={hasMorePodcasts}
            totalPodcasts={totalPodcasts}
            isMobile={isMobile}
          />
        </PodcastContainer>
      </PageSection>
      {currentTrack && (
        <PodcastPlayer
          ref={playerRef}
          track={currentTrack}
          onClose={close}
          onPlayStateChange={setIsAudioPlaying}
        />
      )}
    </>
  )
}

export default PodcastsListingPage
