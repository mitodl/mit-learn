"use client"

import React from "react"
import { Typography, Skeleton, styled } from "ol-components"
import { RiPlayFill, RiPauseFill } from "@remixicon/react"
import {
  useLearningResourcesDetail,
  useInfiniteLearningResourceItems,
} from "api/hooks/learningResources"

import { ResourceTypeEnum } from "api/v1"
import type { PodcastEpisodeResource } from "api/v1"
import { formatDate } from "ol-utilities"
import { HOME, podcastPageView, podcastEpisodePageView } from "@/common/urls"
import DOMPurify from "isomorphic-dompurify"
import { EpisodeItem } from "./PodcastsListingPage/EpisodeItem"
import PodcastContainer from "./PodcastContainer"
import PodcastBreadcrumbs from "./PodcastBreadcrumbs"
import Link from "next/link"
import { usePodcastPage } from "./usePodcastPage"
import {
  getEpisodeAudioUrl,
  getEpisodeDurationMinutes,
  getEpisodeParentPodcast,
} from "./PodcastsListingPage/helpers"
import { EPISODES_PAGE_SIZE } from "./PodcastsListingPage/constants"
import {
  PageSection,
  EpisodeList,
  PlayButton,
  SectionMessage,
} from "./PodcastsListingPage/styled"

import PodcastShareButton from "./PodcastShareButton"
import { env } from "@/env"

const NEXT_PUBLIC_ORIGIN = env("NEXT_PUBLIC_ORIGIN")
/* ── Layout ── */

const HeaderSection = styled("div", {
  shouldForwardProp: (prop) => prop !== "hasEpisodes",
})<{ hasEpisodes?: boolean }>(({ theme, hasEpisodes }) => ({
  ...(hasEpisodes && {
    borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
    marginBottom: "64px",
  }),
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
  lineHeight: "32px",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body1,
    lineHeight: "24px",
    marginTop: "16px",
  },
}))

const StyledPodcastShareButton = styled(PodcastShareButton)({
  padding: "18px 12px",
  margin: "0 0 24px",
})

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

const StyledButton = styled(PlayButton)(({ theme }) => ({
  marginBottom: "32px",
  minWidth: "175px",
  ...theme.typography.body1,
  [theme.breakpoints.down("sm")]: {
    marginBottom: "16px",
  },
}))

const PodcastShareSection = styled("div")({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "8px",
})

const SkeletonLine = styled(Skeleton)({
  marginBottom: "16px",
})

const EpisodeHeaderSkeleton = () => (
  <div data-testid="episode-header-skeleton" aria-hidden>
    <SkeletonLine variant="text" width={160} height={21} />
    <SkeletonLine variant="text" width="80%" height={44} />
    <SkeletonLine variant="text" width="50%" height={24} />
    <SkeletonLine variant="rectangular" width={175} height={48} />
    <SkeletonLine variant="text" width="100%" height={20} />
    <SkeletonLine variant="text" width="95%" height={20} />
    <SkeletonLine variant="text" width="88%" height={20} />
  </div>
)

/* ── Component ── */

type PodcastEpisodeDetailPageProps = {
  episodeId: string
  podcastId: string | null
}

export const PodcastEpisodeDetailPage: React.FC<
  PodcastEpisodeDetailPageProps
> = ({ episodeId, podcastId }) => {
  const { isMobile, playerBar, playingEpisode, isAudioPlaying, toggle, pause } =
    usePodcastPage()

  const {
    data: episode,
    isLoading: episodeLoading,
    isError: episodeError,
  } = useLearningResourcesDetail(Number(episodeId))

  // Parent podcast summary comes embedded in the episode response — prefer the
  // one matching the URL's podcastId, else fall back to the first parent.
  const parentPodcast = episode
    ? getEpisodeParentPodcast(episode, Number(podcastId))
    : null

  const { data: episodesData } = useInfiniteLearningResourceItems(
    Number(podcastId),
    { learning_resource_id: Number(podcastId), limit: EPISODES_PAGE_SIZE },
    { enabled: !!podcastId },
  )
  const episodes =
    episodesData?.pages.flatMap((page) =>
      page.results
        .map((rel) => rel.resource)
        .filter(
          (r) =>
            r.resource_type === ResourceTypeEnum.PodcastEpisode &&
            r.id !== Number(episodeId),
        ),
    ) ?? []
  const duration = episode ? getEpisodeDurationMinutes(episode) : null

  const date = episode?.last_modified
    ? formatDate(episode.last_modified, "MMM D, YYYY")
    : null

  const topics = episode?.topics?.map((t) => t.name).filter(Boolean) ?? []
  const topicString = topics?.join("\u00A0\u00A0\u00A0\u00A0")
  const metaParts = [duration ? `${duration} min` : null, date].filter(Boolean)

  const isCurrentEpisodePlaying =
    !!episode && playingEpisode?.id === episode.id && isAudioPlaying

  const handlePlay = () => {
    if (!episode) return
    toggle(episode, Number(podcastId))
  }

  const podcastHref = podcastId
    ? podcastPageView(podcastId, parentPodcast?.title)
    : "/"

  const sharePageUrl =
    episode && podcastId
      ? `${NEXT_PUBLIC_ORIGIN}${podcastEpisodePageView(String(episode.id), podcastId, episode.title)}`
      : ""

  return (
    <>
      <PageSection variant="gray">
        <PodcastBreadcrumbs
          ancestors={[
            { href: HOME, label: "Home" },
            { href: podcastHref, label: parentPodcast?.title ?? "Podcast" },
          ]}
          current={episode?.title}
        />
        <HeaderSection hasEpisodes={episodes.length > 0}>
          <PodcastContainer contentWidth={624} gutterBreakpoint="sm">
            {episodeLoading ? (
              <EpisodeHeaderSkeleton />
            ) : episodeError ? (
              <SectionMessage variant="body1">
                Something went wrong loading this episode. Please try again
                later.
              </SectionMessage>
            ) : !episode ? (
              <SectionMessage variant="body1">
                This episode is unavailable.
              </SectionMessage>
            ) : (
              <>
                {parentPodcast?.title && (
                  <EpisodeLabel href={podcastHref}>
                    {parentPodcast.title}
                  </EpisodeLabel>
                )}

                <EpisodeTitle variant="h1">{episode.title}</EpisodeTitle>

                {metaParts.length > 0 && (
                  <MetaLine>
                    {metaParts.join("   .   ")}
                    {!isMobile && <Topics> . {topicString}</Topics>}
                  </MetaLine>
                )}
                {isMobile && <Topics>{topicString}</Topics>}
                <PodcastShareSection>
                  {podcastId && (
                    <StyledButton
                      onClick={handlePlay}
                      variant="primary"
                      startIcon={
                        isCurrentEpisodePlaying ? (
                          <RiPauseFill />
                        ) : (
                          <RiPlayFill />
                        )
                      }
                      disabled={!getEpisodeAudioUrl(episode)}
                    >
                      {isCurrentEpisodePlaying
                        ? "Pause Episode"
                        : "Play Episode"}
                    </StyledButton>
                  )}
                  {podcastId && (
                    <StyledPodcastShareButton
                      resource={episode as PodcastEpisodeResource}
                      title={episode.title ?? "episode"}
                      sharePageUrl={sharePageUrl}
                    />
                  )}
                </PodcastShareSection>
                {episode.description && (
                  <Description
                    variant="body1"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(episode.description),
                    }}
                  />
                )}
              </>
            )}
          </PodcastContainer>
        </HeaderSection>
        {episodes && episodes.length > 0 && (
          <PodcastContainer contentWidth={624} gutterBreakpoint="sm">
            <MoreItemDescription>
              More from {parentPodcast?.title ?? "Podcast"}
            </MoreItemDescription>

            <EpisodeList>
              {episodes.map((episode) => (
                <EpisodeItem
                  key={episode.id}
                  isMobile={isMobile}
                  episode={episode}
                  href={
                    podcastId
                      ? podcastEpisodePageView(
                          String(episode.id),
                          podcastId,
                          episode.title,
                        )
                      : ""
                  }
                  isPlaying={
                    playingEpisode?.id === episode.id && isAudioPlaying
                  }
                  onPlayClick={(ep) => toggle(ep, Number(podcastId))}
                  onPauseClick={pause}
                  isPlayable={Boolean(getEpisodeAudioUrl(episode))}
                  isEpisodePage
                />
              ))}
            </EpisodeList>
            {podcastId && (
              <ViewAllLink href={podcastHref}>View all episodes →</ViewAllLink>
            )}
          </PodcastContainer>
        )}
      </PageSection>

      {playerBar}
    </>
  )
}
