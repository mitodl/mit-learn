"use client"

import React, { useState, useEffect } from "react"
import {
  Breadcrumbs,
  Typography,
  Container,
  styled,
  useMediaQuery,
} from "ol-components"
import type { Theme } from "ol-components"
import { Button } from "@mitodl/smoot-design"
import { RiPlayFill } from "@remixicon/react"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import PodcastPlayer, { PLAYER_HEIGHT } from "./PodcastPlayer"
import type { PodcastTrack } from "./PodcastPlayer"
import {
  useLearningResourcesDetail,
  useInfiniteLearningResourceItems,
} from "api/hooks/learningResources"

import { ResourceTypeEnum } from "api/v1"
import type { LearningResource } from "api/v1"
import moment from "moment"
import { formatDate } from "ol-utilities"
import { HOME, podcastPageView } from "@/common/urls"
import DOMPurify from "isomorphic-dompurify"
import { EpisodeItem } from "./PodcastDetailPage"
import PodcastContainer from "./PodcastContainer"
import { notFound } from "next/navigation"
import Link from "next/link"

/* ── Layout ── */

const EpisodeContainer = styled(Container)(({ theme }) => ({
  maxWidth: "624px !important",
  padding: "0 !important",
  [theme.breakpoints.down("sm")]: {
    padding: "0 16px !important",
  },
}))

const PageSection = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.lightGray1,
  minHeight: "100vh",
}))

const HeaderSection = styled.div(({ theme }) => ({
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  marginBottom: "64px",
  paddingBottom: "64px",
  [theme.breakpoints.down("sm")]: {
    marginBottom: "24px",
    paddingBottom: "24px",
  },
}))

const EpisodeLabel = styled(Link)(({ theme }) => ({
  color: theme.custom.colors.darkRed,
  textTransform: "uppercase" as const,
  ...theme.typography.body2,
  fontWeight: theme.typography.fontWeightBold,
  marginBottom: "32px",
  lineHeight: "150%" /* 21px */,
  marginTop: "64px",
  display: "block",
  textDecoration: "none",
  "&:hover": {
    textDecoration: "underline",
  },
  [theme.breakpoints.down("sm")]: {
    marginTop: "32px",
    marginBottom: "8px",
  },
}))

const EpisodeTitle = styled(Typography)(({ theme }) => ({
  marginBottom: "32px",
  display: "block",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h2,
    marginBottom: "18px",
  },
}))

const MoreItemDescription = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.black,
  display: "block",
  marginBottom: "24px",
  fontSize: "24px",
  lineHeight: "30px",
  fontWeight: theme.typography.fontWeightBold,
  [theme.breakpoints.down("sm")]: {
    marginBottom: "24px",
    marginTop: "64px",
  },
}))

const MetaLine = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  marginBottom: "32px",
  display: "block",
  ...theme.typography.body1,
  fontWeight: theme.typography.fontWeightMedium,
  lineHeight: "150%",
  [theme.breakpoints.down("sm")]: {
    marginBottom: "16px",
  },
}))

const Topics = styled.span(({ theme }) => ({
  color: theme.custom.colors.darkGray1,
  ...theme.typography.body1,
  lineHeight: "20px",
  [theme.breakpoints.down("sm")]: {
    marginBottom: "16px",
    display: "block",
  },
}))

const Description = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  display: "block",
  marginBottom: "32px",
  marginTop: "32px",
  fontSize: "18px",
  fontStyle: "normal",
  fontWeight: theme.typography.fontWeightBold,
  lineHeight: "32px",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body1,
    lineHeight: "24px",
    marginTop: "16px",
  },
}))

const EpisodeList = styled.ul({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gridTemplateColumns: "1fr",
})

export const BreadcrumbBar = styled.div(({ theme }) => ({
  padding: "20px 0 4px 0",
  borderBottom: `2px solid ${theme.custom.colors.red}`,
  backgroundColor: theme.custom.colors.white,
  [theme.breakpoints.down("sm")]: {
    padding: "16px 0 0 0",
  },
}))

const ViewAllLink = styled.a(({ theme }) => ({
  color: theme.custom.colors.darkRed,
  ...theme.typography.body1,
  fontWeight: theme.typography.fontWeightMedium,
  lineHeight: "150%",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  marginTop: "40px",
  marginBottom: "64px",
  "&:hover": {
    textDecoration: "underline",
  },
  [theme.breakpoints.down("sm")]: {
    marginBottom: "40px",
  },
}))

const StyledButton = styled(Button)(({ theme }) => ({
  marginBottom: "32px",
  padding: "12px 24px 12px 20px",
  minWidth: "175px",
  ...theme.typography.body1,
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    marginBottom: "16px",
  },
}))

/* ── Component ── */

type PodcastEpisodeDetailPageProps = {
  episodeId: string
  podcastId: string | null
}

export const PodcastEpisodeDetailPage: React.FC<
  PodcastEpisodeDetailPageProps
> = ({ episodeId, podcastId }) => {
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"))
  const [playingEpisode, setPlayingEpisode] = useState<LearningResource | null>(
    null,
  )

  const showPodcastDetailPage = useFeatureFlagEnabled(
    FeatureFlags.PodcastDetailPage,
  )
  const flagsLoaded = useFeatureFlagsLoaded()
  const { data: episode } = useLearningResourcesDetail(Number(episodeId))
  // Fetch podcast only when a valid numeric podcastId is provided
  const { data: podcast } = useLearningResourcesDetail(Number(podcastId) || 0)

  const podcastEpisode =
    episode?.resource_type === ResourceTypeEnum.PodcastEpisode
      ? episode.podcast_episode
      : null

  const { data: episodesData } = useInfiniteLearningResourceItems(
    Number(podcastId),
    { learning_resource_id: Number(podcastId), limit: 5 },
    { enabled: !!podcast },
  )
  const episodes =
    episodesData?.pages.flatMap((page) =>
      page.results
        .map((rel) => rel.resource)
        .filter((r) => r.resource_type === ResourceTypeEnum.PodcastEpisode),
    ) ?? []
  const duration = podcastEpisode?.duration
    ? Math.round(moment.duration(podcastEpisode.duration).asMinutes())
    : null

  const date = episode?.last_modified
    ? formatDate(episode.last_modified, "MMM D, YYYY")
    : null

  const topics = episode?.topics?.map((t) => t.name).filter(Boolean) ?? []
  const topicString = topics?.join("  ")
  const metaParts = [duration ? `${duration} min` : null, date].filter(Boolean)

  const getAudioUrl = (ep: LearningResource): string | null => {
    if (ep.resource_type !== ResourceTypeEnum.PodcastEpisode) return null
    const candidate =
      ep.podcast_episode?.audio_url ?? ep.podcast_episode?.episode_link
    return candidate?.trim() ? candidate : null
  }

  const handlePlay = () => {
    if (episode && getAudioUrl(episode)) {
      setPlayingEpisode(episode)
    }
  }

  const currentTrack: PodcastTrack | null = playingEpisode
    ? (() => {
        const audioUrl = getAudioUrl(playingEpisode)
        if (!audioUrl) return null
        return {
          audioUrl,
          title: playingEpisode.title || "Untitled Episode",
          podcastName: podcast?.title || "Podcast",
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

  const podcastHref = podcastId ? podcastPageView(podcastId) : "/"

  if (!showPodcastDetailPage) {
    return flagsLoaded ? notFound() : null
  }
  return (
    <>
      <PageSection>
        <BreadcrumbBar>
          <PodcastContainer>
            <Breadcrumbs
              variant="light"
              ancestors={[
                { href: HOME, label: "Home" },
                { href: podcastHref, label: podcast?.title ?? "Podcast" },
              ]}
              current={episode?.title}
            />
          </PodcastContainer>
        </BreadcrumbBar>
        <HeaderSection>
          <EpisodeContainer>
            {podcast?.title && (
              <EpisodeLabel href={podcastHref}>{podcast.title}</EpisodeLabel>
            )}

            <EpisodeTitle variant="h1">{episode?.title ?? ""}</EpisodeTitle>

            {metaParts.length > 0 && (
              <MetaLine>
                {metaParts.join("   .   ")}
                {!isMobile && <Topics> . {topicString}</Topics>}
              </MetaLine>
            )}
            {isMobile && <Topics>{topicString}</Topics>}
            {episode && (
              <StyledButton
                onClick={handlePlay}
                variant="primary"
                startIcon={<RiPlayFill />}
                disabled={!episode || !getAudioUrl(episode)}
              >
                Play Episode
              </StyledButton>
            )}

            {episode?.description && (
              <Description
                variant="body1"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(episode.description),
                }}
              />
            )}
          </EpisodeContainer>
        </HeaderSection>
        <EpisodeContainer>
          <MoreItemDescription>
            More from {podcast?.title ?? "Podcast"}
          </MoreItemDescription>
          {episodes && episodes.length > 0 && (
            <EpisodeList>
              {episodes.map((episode) => (
                <EpisodeItem
                  key={episode.id}
                  episode={episode}
                  isPlaying={playingEpisode?.id === episode.id}
                  onPlayClick={(ep) => {
                    if (getAudioUrl(ep)) setPlayingEpisode(ep)
                  }}
                  isPlayable={Boolean(getAudioUrl(episode))}
                  isEpisodePage
                />
              ))}
            </EpisodeList>
          )}
          <ViewAllLink href={podcastHref}>View all episodes →</ViewAllLink>
        </EpisodeContainer>
      </PageSection>

      {currentTrack && (
        <PodcastPlayer
          track={currentTrack}
          onClose={() => setPlayingEpisode(null)}
        />
      )}
    </>
  )
}
