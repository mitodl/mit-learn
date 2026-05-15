"use client"

import React, { useState, useEffect, useRef } from "react"
import { notFound } from "next/navigation"
import { useRouter } from "next-nprogress-bar"
import { Breadcrumbs, Typography, styled, useMediaQuery } from "ol-components"
import type { Theme } from "ol-components"
import { Button, ActionButton } from "@mitodl/smoot-design"
import { RiPlayFill, RiPauseFill } from "@remixicon/react"
import PodcastPlayer, { PLAYER_HEIGHT } from "./PodcastPlayer"
import type { PodcastTrack, PodcastPlayerHandle } from "./PodcastPlayer"
import {
  useLearningResourcesDetail,
  useInfiniteLearningResourceItems,
} from "api/hooks/learningResources"
import { ResourceTypeEnum } from "api/v1"
import type { LearningResource } from "api/v1"
import moment from "moment"
import { formatDate } from "ol-utilities"
import { HOME, podcastEpisodePageView } from "@/common/urls"
import PodcastContainer from "./PodcastContainer"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"

const HeaderSection = styled.div(({ theme }) => ({
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  marginBottom: "56px",
  overflow: "hidden",
  [theme.breakpoints.down("sm")]: {
    paddingBottom: "32px",
    marginBottom: "0",
    borderBottom: "none",
  },
}))

const PodcastTitle = styled(Typography)(({ theme }) => ({
  marginBottom: "24px",
  gridArea: "title",

  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h2,
  },
}))

const StyledHeaderSection = styled.div(({ theme }) => ({
  padding: "64px 0",
  [theme.breakpoints.down("sm")]: {
    padding: "32px 0 0",
  },
}))

const MetaLine = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  marginBottom: "16px",
  display: "block",
  ...theme.typography.body2,
  lineHeight: "26px",
  [theme.breakpoints.down("sm")]: {
    marginBottom: "8px",
  },
}))

const Description = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  display: "block",
  marginBottom: "16px",
  ...theme.typography.body1,
  lineHeight: "26px",
  [theme.breakpoints.down("sm")]: {
    marginBottom: "8px",
    ...theme.typography.body2,
    lineHeight: "22px",
  },
}))

const LatestEpisodeLine = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  marginBottom: "16px",
  ...theme.typography.body1,
  lineHeight: "26px",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body2,
    lineHeight: "22px",
    marginBottom: "24px",
  },
}))

const PodcastImage = styled.img(({ theme }) => ({
  gridArea: "image",
  width: "280px",
  height: "280px",
  objectFit: "cover",
  borderRadius: "8px",
  flexShrink: 0,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    height: "auto",
    aspectRatio: "1 / 1",
    borderRadius: "0px",
    marginBottom: "16px",
  },
}))

const HeaderContent = styled.div(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr 280px",
  gridTemplateAreas: '"title image" "text image"',
  columnGap: "164px",

  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
    gridTemplateAreas: '"title" "image" "text"',
    columnGap: "0",
  },
}))

const HeaderTextContent = styled.div({
  gridArea: "text",
})

/* ── Episodes list ── */

const EpisodesSection = styled.div(({ theme }) => ({
  padding: "0 48px",
  [theme.breakpoints.down("sm")]: {
    padding: "0 0 48px",
  },
}))

const EpisodesHeading = styled(Typography)(({ theme }) => ({
  textTransform: "uppercase" as const,
  color: theme.custom.colors.black,
  ...theme.typography.body3,
  marginBottom: "24px",

  fontSize: "12px",
  fontStyle: "normal",
  fontWeight: theme.typography.fontWeightBold,
  lineHeight: "150%" /* 18px */,
  letterSpacing: "1.92px",

  [theme.breakpoints.down("sm")]: {
    fontWeight: theme.typography.fontWeightBold,
    lineHeight: "150%",
    letterSpacing: "1.92px",
    textTransform: "uppercase",
  },
}))

const EpisodeList = styled.div({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gridTemplateColumns: "1fr",
})

const EpisodeRow = styled("div", {
  shouldForwardProp: (prop) => prop !== "isEpisodePage",
})<{ isEpisodePage?: boolean }>(({ theme, isEpisodePage }) => ({
  cursor: "pointer",
  margin: 0,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  padding: !isEpisodePage ? "28px 16px" : "28px 0px",
  ...(isEpisodePage && {
    "&:first-of-type": { paddingTop: 0, boxShadow: "none" },
    // When there is only one episode (first AND last), keep only the bottom
    // shadow — the top shadow from :first-of-type should remain removed.
    "&:first-of-type:last-child": {
      boxShadow: `0 1px 0 ${theme.custom.colors.lightGray2}`,
    },
  }),
  boxShadow: `0 -1px 0 ${theme.custom.colors.lightGray2}`,
  gap: "16px",
  "&:last-child": {
    boxShadow: `0 -1px 0 ${theme.custom.colors.lightGray2}, 0 1px 0 ${theme.custom.colors.lightGray2}`,
  },
  "&:hover": {
    backgroundColor: theme.custom.colors.lightGray1,
    cursor: "pointer",
  },
  "&:hover .episode-title, &:focus-visible .episode-title": {
    color: theme.custom.colors.red,
  },
  "&:hover .play-button, &:focus-visible .play-button": {
    color: theme.custom.colors.red,
  },
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "16px",
    padding: "24px 16px",
  },
}))

const EpisodeInfo = styled.div(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}))

const EpisodeTitleLink = styled.span(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.darkGray2,
  textDecoration: "none",
  display: "block",
  fontSize: "18px",
  fontStyle: "normal",
  fontWeight: theme.typography.fontWeightBold,
  lineHeight: "26px",
}))

const StyledButton = styled(Button)(({ theme }) => ({
  padding: "16px 20px",
  ...theme.typography.body1,
  fontWeight: theme.typography.fontWeightMedium,
  lineHeight: "16px",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}))

const StyledShowMoreContainer = styled("div")({
  width: "100%",
  display: "flex",
  justifyContent: "center",
})
const StyledShowMore = styled(Button)(({ theme }) => ({
  minWidth: "140px",
  margin: "40px 0 56px 0",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}))

const StyledIcon = styled(RiPlayFill)({
  width: "24px !important",
  height: "24px !important",
})

const BreadcrumbBar = styled.div(({ theme }) => ({
  padding: "18px 0 2px 0",
  borderBottom: `1px solid ${theme.custom.colors.red}`,
  [theme.breakpoints.down("sm")]: {
    padding: "12px 0 0px 0",
  },
}))

const EpisodeRight = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "28px",
  flexShrink: 0,
  [theme.breakpoints.down("sm")]: {
    alignItems: "center",
    justifyContent: "flex-end",
    width: "100%",
  },
}))

const StyledDot = styled.span(({ theme }) => ({
  display: "inline-block",
  fontSize: "14px",
  padding: "0 6px",
  fontWeight: theme.typography.fontWeightBold,
}))

const PageSection = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
}))

const EpisodeMeta = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray1,
  whiteSpace: "nowrap",
  textAlign: "right",
}))

const PlayButton = styled(ActionButton, {
  shouldForwardProp: (prop) => prop !== "isPlaying",
})<{
  isPlaying: boolean
}>(({ theme, isPlaying }) => [
  {
    width: "48px",
    height: "48px",
    color: theme.custom.colors.darkGray2,
    backgroundColor: theme.custom.colors.white,
    borderColor: "currentColor",
    "&:hover:not(:disabled)": {
      color: theme.custom.colors.red,
    },
    [theme.breakpoints.down("sm")]: {
      width: "80px",
      height: "48px",
      backgroundColor: theme.custom.colors.white,
    },
  },
  isPlaying && {
    color: theme.custom.colors.red,
  },
])

/* ── Episode row component ── */

export type EpisodeItemProps = {
  episode: LearningResource
  href: string
  onPlayClick: (episode: LearningResource) => void
  onPauseClick?: () => void
  isPlaying: boolean
  isPlayable: boolean
  isEpisodePage?: boolean
}

export const EpisodeItem: React.FC<EpisodeItemProps> = ({
  episode,
  href,
  onPlayClick,
  onPauseClick,
  isPlaying,
  isPlayable,
  isEpisodePage = false,
}) => {
  const router = useRouter()
  const podcastEpisode =
    episode.resource_type === "podcast_episode" ? episode.podcast_episode : null

  const duration = podcastEpisode?.duration
    ? Math.round(moment.duration(podcastEpisode.duration).asMinutes())
    : null

  const date = episode.last_modified
    ? formatDate(episode.last_modified, "MMM D")
    : null

  const metaParts = [duration ? `${duration} min` : null, date].filter(Boolean)

  return (
    <EpisodeRow onClick={() => router.push(href)} isEpisodePage={isEpisodePage}>
      <EpisodeInfo>
        <EpisodeTitleLink className="episode-title">
          {episode.title}
        </EpisodeTitleLink>
      </EpisodeInfo>

      <EpisodeRight>
        {metaParts.length > 0 && (
          <EpisodeMeta variant="body3">
            {metaParts.map((part, i) => (
              <React.Fragment key={i}>
                {i > 0 && <StyledDot>&middot;</StyledDot>}
                {part}
              </React.Fragment>
            ))}
          </EpisodeMeta>
        )}
        <PlayButton
          aria-label={
            isPlaying ? `Pause ${episode.title}` : `Play ${episode.title}`
          }
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (isPlaying) {
              onPauseClick?.()
            } else {
              onPlayClick(episode)
            }
          }}
          isPlaying={isPlaying}
          disabled={!isPlayable}
          variant="secondary"
          className="play-button"
        >
          {isPlaying ? <RiPauseFill size={20} /> : <RiPlayFill size={20} />}
        </PlayButton>
      </EpisodeRight>
    </EpisodeRow>
  )
}

/* ── Page ── */

type PodcastDetailPageProps = {
  podcastId: string
}

const EPISODES_PAGE_SIZE = 5

export const PodcastDetailPage: React.FC<PodcastDetailPageProps> = ({
  podcastId,
}) => {
  const showPodcastDetailPage = useFeatureFlagEnabled(
    FeatureFlags.PodcastDetailPage,
  )
  const flagsLoaded = useFeatureFlagsLoaded()
  const id = Number(podcastId)
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"))
  const [playingEpisode, setPlayingEpisode] = useState<LearningResource | null>(
    null,
  )
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const playerRef = useRef<PodcastPlayerHandle>(null)

  const { data: resource } = useLearningResourcesDetail(id)

  const {
    data: episodesData,
    isLoading: episodesLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteLearningResourceItems(
    id,
    { learning_resource_id: id, limit: EPISODES_PAGE_SIZE },
    { enabled: !!resource },
  )

  const episodes =
    episodesData?.pages.flatMap((page) =>
      page.results
        .map((rel) => rel.resource)
        .filter((r) => r.resource_type === ResourceTypeEnum.PodcastEpisode),
    ) ?? []

  const isPodcast = resource?.resource_type === ResourceTypeEnum.Podcast
  const podcast = isPodcast ? resource.podcast : null

  const offeredBy = resource?.offered_by?.name
  const lastModified = resource?.last_modified
    ? formatDate(resource.last_modified, "MMM YYYY")
    : null
  const episodeCount = podcast?.episode_count

  const metaParts = [
    offeredBy,
    episodeCount ? `${episodeCount} episodes` : null,
    lastModified ? `Updated ${lastModified}` : null,
  ].filter(Boolean)

  const latestEpisode = episodes?.[0]
  const latestEpisodeDuration = latestEpisode?.podcast_episode?.duration
    ? Math.round(
        moment.duration(latestEpisode.podcast_episode.duration).asMinutes(),
      )
    : null
  const latestEpisodeDate = latestEpisode?.last_modified
    ? formatDate(latestEpisode.last_modified, "MMM D")
    : null

  const getEpisodeAudioUrl = (episode: LearningResource): string | null => {
    if (episode.resource_type !== "podcast_episode") return null

    const candidateUrl =
      episode.podcast_episode?.audio_url ??
      episode.podcast_episode?.episode_link

    return candidateUrl?.trim() ? candidateUrl : null
  }

  const handlePlayClick = (episode: LearningResource) => {
    if (!getEpisodeAudioUrl(episode)) return
    if (playingEpisode?.id === episode.id) {
      playerRef.current?.resume()
    } else {
      setPlayingEpisode(episode)
    }
  }

  const currentTrack: PodcastTrack | null = playingEpisode
    ? (() => {
        const audioUrl = getEpisodeAudioUrl(playingEpisode)
        if (!audioUrl) return null

        return {
          audioUrl,
          title: playingEpisode.title || "Untitled Episode",
          podcastName: resource?.title || "Podcast",
        }
      })()
    : null

  // When the player is active, shrink the page layout so the footer is
  // visible above the fixed player bar.
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

  if (!showPodcastDetailPage) {
    return flagsLoaded ? notFound() : null
  }

  return (
    <>
      <PageSection>
        <HeaderSection>
          <BreadcrumbBar>
            <PodcastContainer>
              <Breadcrumbs
                variant="light"
                ancestors={[{ href: HOME, label: "Home" }]}
                current={resource?.title}
              />
            </PodcastContainer>
          </BreadcrumbBar>
          <PodcastContainer>
            <StyledHeaderSection>
              <HeaderContent>
                <PodcastTitle variant="h1">
                  {resource?.title ?? ""}
                </PodcastTitle>

                {resource?.image?.url && (
                  <PodcastImage
                    src={resource.image.url}
                    alt={
                      resource.image.alt ?? resource.title ?? "Podcast cover"
                    }
                  />
                )}

                <HeaderTextContent>
                  {metaParts.length > 0 && (
                    <MetaLine variant="body3">{metaParts.join(" · ")}</MetaLine>
                  )}

                  {resource?.description && (
                    <Description variant="body2">
                      {resource.description}
                    </Description>
                  )}

                  {latestEpisode && (
                    <LatestEpisodeLine variant="body3">
                      {"Latest episode: "}
                      {latestEpisode.title}
                      {latestEpisodeDuration
                        ? ` · ${latestEpisodeDuration} min`
                        : ""}
                      {latestEpisodeDate ? ` · ${latestEpisodeDate}` : ""}
                    </LatestEpisodeLine>
                  )}

                  {latestEpisode && (
                    <StyledButton
                      onClick={() => handlePlayClick(latestEpisode)}
                      variant="primary"
                      startIcon={<StyledIcon />}
                      disabled={!getEpisodeAudioUrl(latestEpisode)}
                    >
                      Play Latest Episode
                    </StyledButton>
                  )}
                </HeaderTextContent>
              </HeaderContent>
            </StyledHeaderSection>
          </PodcastContainer>
        </HeaderSection>

        <PodcastContainer>
          <EpisodesSection>
            <EpisodesHeading variant="subtitle3">Episodes</EpisodesHeading>

            {episodes && episodes.length > 0 && (
              <EpisodeList>
                {episodes.map((episode) => (
                  <EpisodeItem
                    key={episode.id}
                    episode={episode}
                    href={podcastEpisodePageView(
                      String(episode.id),
                      String(id),
                    )}
                    onPlayClick={handlePlayClick}
                    onPauseClick={() => playerRef.current?.pause()}
                    isPlaying={
                      playingEpisode?.id === episode.id && isAudioPlaying
                    }
                    isPlayable={Boolean(getEpisodeAudioUrl(episode))}
                  />
                ))}
              </EpisodeList>
            )}
            {(hasNextPage || episodesLoading) && (
              <StyledShowMoreContainer>
                <StyledShowMore
                  variant="secondary"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? "Loading..." : "Load more episodes"}
                </StyledShowMore>
              </StyledShowMoreContainer>
            )}

            {!episodesLoading && episodes?.length === 0 && (
              <Typography variant="body1" color="text.secondary">
                No episodes found.
              </Typography>
            )}
          </EpisodesSection>
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
