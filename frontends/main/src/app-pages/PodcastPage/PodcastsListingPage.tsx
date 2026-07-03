"use client"

import React, { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  Breadcrumbs,
  Typography,
  styled,
  useMediaQuery,
} from "ol-components"
import type { Theme } from "ol-components"
import { Button, ButtonLink, ActionButton } from "@mitodl/smoot-design"
import { RiPlayFill, RiPauseFill, RiArrowRightLine } from "@remixicon/react"
import moment from "moment"
import { formatDate } from "ol-utilities"
import { useLearningResourcesList } from "api/hooks/learningResources"
import {
  ResourceTypeEnum,
  LearningResourcesListSortbyEnum,
} from "api/v1"
import type { LearningResource } from "api/v1"
import {
  HOME,
  SEARCH_PODCASTS,
  podcastPageView,
  podcastEpisodePageView,
} from "@/common/urls"
import PodcastContainer from "./PodcastContainer"
import PodcastPlayer, { PLAYER_HEIGHT } from "./PodcastPlayer"
import type { PodcastTrack, PodcastPlayerHandle } from "./PodcastPlayer"

const EPISODES_PAGE_SIZE = 5
const SERIES_FEATURED_COUNT = 2
const SERIES_MORE_COUNT = 5

/* ── Layout ── */

const PageSection = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
}))

const BreadcrumbBar = styled.div(({ theme }) => ({
  padding: "18px 0 2px 0",
  borderBottom: `1px solid ${theme.custom.colors.red}`,
  [theme.breakpoints.down("sm")]: {
    padding: "12px 0 0px 0",
  },
}))

const StyledPodcastContainer = styled(PodcastContainer)(({ theme }) => ({
    maxWidth: "1320px !important",
    padding: "0px 24px !important",
    [theme.breakpoints.down("sm")]: {
      padding: "0px 16px !important",
    },
}))

const HeroSection = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  padding: "96px 0",
  textAlign: "center",
  [theme.breakpoints.down("sm")]: {
    padding: "32px 0 40px 0",
    textAlign: "left",
    justifyContent: "flex-start",
  },
}))

const HeroHeading = styled(Typography)(({ theme }) => ({
  ...theme.typography.h1,
  fontSize: "64px",
  lineHeight: 1.2,
  letterSpacing: "-1.28px",
  display: "block",
  color: theme.custom.colors.black,
  marginBottom: "24px",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h2,
    marginBottom: "8px",
    letterSpacing: "normal",
  },
}))

const HeroDescription = styled(Typography)(({ theme }) => ({
  fontSize: "24px",
  lineHeight: 1.4,
  color: theme.custom.colors.darkGray1,
  marginBottom: "24px",
  [theme.breakpoints.down("sm")]: {
    fontSize: "16px",
    lineHeight: "26px",
    marginBottom: "8px",
  },
}))

const HeroStats = styled(Typography)(({ theme }) => ({
  fontSize: "14px",
  lineHeight: "22px",
  color: theme.custom.colors.silverGrayDark,
}))

const SectionDivider = styled.div(({ theme }) => ({
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
}))

const Section = styled.div(({ theme }) => ({
  paddingTop: "80px",
  [theme.breakpoints.down("sm")]: {
    paddingTop: "64px",
  },
}))

const SectionHeader = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: `2px solid ${theme.custom.colors.silverGray}`,
  paddingBottom: "21px",
  [theme.breakpoints.down("sm")]: {
    paddingBottom: "24px",
  },
}))

const SectionTitle = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.black,
  lineHeight: "24px",
}))

const SectionLink = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.red,
  lineHeight: "24px",
  textDecorationLine: "underline",
  textDecorationStyle: "solid",
  textDecorationSkipInk: "none",
  textDecorationThickness: "auto",
  textUnderlineOffset: "auto",
  textUnderlinePosition: "from-font",
}))

/* ── Now Playing ── */

const NowPlayingHeader = styled.div({
  display: "flex",
  width: "100%",
})

const NowPlayingTitleWrap = styled.div(({ theme }) => ({
  display: "inline-flex",
  alignItems: "flex-start",
  flexShrink: 0,
  borderTop: `2px solid ${theme.custom.colors.brightRed}`,
  paddingTop: "14px",
  paddingBottom: "22px",
}))

const NowPlayingLabel = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.black,
  whiteSpace: "nowrap",
  lineHeight: "24px",
  [theme.breakpoints.down("sm")]: {
   lineHeight: "18px",
  },
}))

const NowPlayingCard = styled.div(({ theme }) => ({
  display: "flex",
  gap: "48px",
  padding: "40px",
  alignItems: "flex-start",
  backgroundColor: theme.custom.colors.lightGray1,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    gap: "16px",
    padding: "0px",
    backgroundColor: "transparent",
    border: "none",
  },
}))

const NowPlayingImage = styled.img(({ theme }) => ({
  width: "250px",
  height: "250px",
  objectFit: "cover",
  flexShrink: 0,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    height: "auto",
    aspectRatio: "1 / 1",
    borderRadius: "8px",
  },
}))

const NowPlayingBody = styled.div({
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const FeaturedBadge = styled.div(({ theme }) => ({
  display: "inline-flex",
  alignSelf: "flex-start",
  padding: "8px 16px",
  backgroundColor: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  ...theme.typography.subtitle3,
}))

const NowPlayingTitle = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  fontSize: "28px",
  lineHeight: "40px",
  [theme.breakpoints.down("sm")]: {
    fontSize: "18px",
    lineHeight: "26px",
    fontWeight: theme.typography.fontWeightBold,
  },
}))

const NowPlayingMeta = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  lineHeight: "24px",
}))

const NowPlayingBottom = styled.div(({ theme }) => ({
  display: "flex",
  gap: "80px",
  alignItems: "flex-start",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    gap: "24px",
  },
}))

const NowPlayingDescription = styled(Typography)(({ theme }) => ({
  flex: 1,
  color: theme.custom.colors.darkGray2,
  display: "-webkit-box",
  lineHeight: "22px",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 3,
  overflow: "hidden",
  [theme.breakpoints.down("sm")]: {
    WebkitLineClamp: 4,
  },
}))

const NowPlayingRight = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "16px",
  width: "186px",
  flexShrink: 0,
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    alignItems: "flex-start",
  },
}))

const PlayEpisodeButton = styled(Button)({
  width: "100%",
  padding: "12px 24px 12px 20px",
  height: "48px"
})

const LoadMoreEpisodeButton = styled(Button)(({ theme }) => ({
  padding: "12px 32px",
  height: "48px",
  fontSize: "16px",
  lineHeight: "16px",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}))

const NowPlayingDuration = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray1,
  whiteSpace: "nowrap",
}))

/* ── Latest episodes ── */

const EpisodeList = styled.div({
  display: "grid",
  gridTemplateColumns: "1fr",
})

const LoadMoreContainer = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "start",
  paddingTop: "40px",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}))

/* ── Series ── */

const SeriesDescription = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  padding: "40px 0",
  lineHeight: "24px",
  [theme.breakpoints.down("sm")]: {
    padding: "32px 0",
  },
}))

const SeriesGroup = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "56px",
})

const FeaturedLabel = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  padding: "24px 2px 24px 0",
}))

const FeaturedSeriesRow = styled.div(({ theme }) => ({
  display: "flex",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
  },
}))

const FeaturedSeriesCard = styled(Link)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
  padding: "40px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  textDecoration: "none",
  // Adjacent cards share a single 1px divider instead of a doubled border.
  "&:not(:first-of-type)": {
    borderLeft: "none",
  },
  "&:hover .series-card-title": {
    color: theme.custom.colors.red,
  },
  [theme.breakpoints.down("sm")]: {
    padding: "24px",
    // Cards stack vertically on mobile, so adjacent cards share a single
    // horizontal divider instead of a vertical one.
    "&:not(:first-of-type)": {
      borderLeft: `1px solid ${theme.custom.colors.lightGray2}`,
      borderTop: "none",
    },
  },
}))

const FeaturedSeriesImage = styled.img({
  width: "72px",
  height: "72px",
  objectFit: "cover",
  borderRadius: "8px",
  marginBottom: "24px",
})

const FeaturedSeriesOfferedBy = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  lineHeight: "22px",
  marginBottom: "8px",
}))

const FeaturedSeriesTitle = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  marginBottom: "8px",
}))

const FeaturedSeriesSummary = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  lineHeight: "24px",
  marginBottom: "16px",
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
}))

const FeaturedSeriesMeta = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  lineHeight: "22px",
}))

const MoreSeriesRow = styled(Link)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  padding: "23px 0 24px 0",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  textDecoration: "none",
  "&:hover .series-row-title": {
    color: theme.custom.colors.red,
  },
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "8px",
  },
}))

const MoreSeriesLeft = styled.div({
  display: "flex",
  alignItems: "center",
  gap: "16px",
  minWidth: 0,
})

const MoreSeriesTitle = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  whiteSpace: "nowrap",
}))

const MoreSeriesOfferedBy = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
}))

const MoreSeriesMeta = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray1,
  whiteSpace: "nowrap",
}))

const ViewAllContainer = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "16px",
  paddingTop: "40px",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}))

const ViewAllButton = styled(ButtonLink)(({ theme }) => ({
  padding: "12px 32px 12px 32px",
  height: "48px",
  ...theme.typography.body1,
  lineHeight: "16px",
  color: theme.custom.colors.darkRed,
  fontWeight: theme.typography.fontWeightMedium,
  whiteSpace: "nowrap",
  "&:hover:not(:disabled)": {
    color: theme.custom.colors.darkRed,
  },
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    justifyContent: "center",
  },
}))

const StyledRiArrowRightLine = styled(RiArrowRightLine)(({ theme }) => ({
    fontSize: "24px",
}))

const EpisodeRow = styled(Link, {
  shouldForwardProp: (prop) => prop !== "isEpisodePage",
})<{ isEpisodePage?: boolean }>(({ theme, isEpisodePage }) => ({
  textDecoration: "none",
  margin: 0,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  padding: !isEpisodePage ? "24px 16px" : "24px 0px",
  ...(isEpisodePage && {
    "&:first-of-type": { paddingTop: 0, boxShadow: "none" },
    // When there is only one episode (first AND last), keep only the bottom
    // shadow — the top shadow from :first-of-type should remain removed.
    "&:first-of-type:last-child": {
      boxShadow: `0 1px 0 ${theme.custom.colors.lightGray2}`,
    },
  }),
  gap: "16px",
  "&:last-child": {
    boxShadow: `0 -1px 0 ${theme.custom.colors.lightGray2}, 0 1px 0 ${theme.custom.colors.lightGray2}`,
  },
  "&:hover": {
    backgroundColor: theme.custom.colors.lightGray1,
    cursor: "pointer",
  },
  "&:focus-visible": {
    outline: `2px solid ${theme.custom.colors.red}`,
    outlineOffset: "-2px",
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

const EpisodeOverline = styled.span(({ theme }) => ({
  ...theme.typography.subtitle3,
  color: theme.custom.colors.silverGrayDark,
  textTransform: "uppercase",
  display: "block",
  marginBottom: "8px",
  lineHeight: "16px"
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
  [theme.breakpoints.down("sm")]: {
    marginBottom: "8px"
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

const EpisodeDescription = styled(Typography)(({ theme }) => ({ 
  [theme.breakpoints.down("sm")]: {
   ...theme.typography.body1,
   lineHeight: "20px",
  },
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
  role?: string
  overline?: string
  onPlayClick: (episode: LearningResource) => void
  onPauseClick?: () => void
  isPlaying: boolean
  isPlayable: boolean
  isEpisodePage?: boolean
  isMobile: boolean
}

export const EpisodeItem: React.FC<EpisodeItemProps> = ({
  episode,
  href,
  role,
  overline,
  onPlayClick,
  onPauseClick,
  isPlaying,
  isPlayable,
  isEpisodePage = false,
  isMobile
}) => {
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
    <EpisodeRow href={href} role={role} isEpisodePage={isEpisodePage}>
      <EpisodeInfo>
        {isMobile && overline && <EpisodeOverline>TILCLIMATE  •  NVIRONMENTAL SOLUTIONS INITIATIVE</EpisodeOverline>}
        <EpisodeTitleLink className="episode-title">
          {/* {episode.title} */}
          Where We’ve Been and Where We’re Going
        </EpisodeTitleLink>
        <EpisodeDescription className="episode-description">
          {/* {episode.description} */}
          The team reflects on four seasons of climate conversations and what's ahead.
        </EpisodeDescription>
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

/* ── Helpers ── */

const formatApproxCount = (count: number): string =>
  count >= 100 ? `${Math.floor(count / 100) * 100}+` : String(count)

const getEpisodeAudioUrl = (episode: LearningResource): string | null => {
  if (episode.resource_type !== ResourceTypeEnum.PodcastEpisode) return null
  const candidateUrl =
    episode.podcast_episode?.audio_url ?? episode.podcast_episode?.episode_link
  return candidateUrl?.trim() ? candidateUrl : null
}

const getEpisodeDurationMinutes = (
  episode: LearningResource,
): number | null => {
  if (episode.resource_type !== ResourceTypeEnum.PodcastEpisode) return null
  const duration = episode.podcast_episode?.duration
  return duration ? Math.round(moment.duration(duration).asMinutes()) : null
}

const getEpisodeParentPodcastId = (
  episode: LearningResource,
): number | null => {
  if (episode.resource_type !== ResourceTypeEnum.PodcastEpisode) return null
  return episode.podcast_episode?.podcasts?.[0] ?? null
}

/* ── Page ── */

export const PodcastsListingPage: React.FC = () => {
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"))
  const [playingEpisode, setPlayingEpisode] = useState<LearningResource | null>(
    null,
  )
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const playerRef = useRef<PodcastPlayerHandle>(null)
  const [episodesLimit, setEpisodesLimit] = useState(EPISODES_PAGE_SIZE + 1)
  const seriesLimit = SERIES_FEATURED_COUNT + SERIES_MORE_COUNT

  const { data: episodesData, isFetching: isFetchingEpisodes } =
    useLearningResourcesList({
      resource_type: [ResourceTypeEnum.PodcastEpisode],
      sortby: LearningResourcesListSortbyEnum.LastModified,
      limit: episodesLimit,
    })

  const { data: seriesData } = useLearningResourcesList({
    resource_type: [ResourceTypeEnum.Podcast],
    sortby: LearningResourcesListSortbyEnum.LastModified,
    limit: seriesLimit,
  })

  const episodes = episodesData?.results ?? []
  const totalEpisodes = episodesData?.count ?? 0
  const nowPlaying = episodes[0]
  const latestEpisodes = episodes.slice(1)
  const hasMoreEpisodes = episodes.length < totalEpisodes

  const series = seriesData?.results ?? []
  const totalSeries = seriesData?.count ?? 0
  const featuredSeries = series.slice(0, SERIES_FEATURED_COUNT)
  const moreSeries = series.slice(SERIES_FEATURED_COUNT)
  const hasMoreSeries = series.length < totalSeries

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

  const nowPlayingDuration = nowPlaying
    ? getEpisodeDurationMinutes(nowPlaying)
    : null
  const nowPlayingDate = nowPlaying?.last_modified
    ? formatDate(nowPlaying.last_modified, "MMM D")
    : null
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

        <HeroSection>
          <PodcastContainer>
            <HeroHeading variant="h1">Podcasts from across MIT</HeroHeading>
            <HeroDescription variant="body1">
              New podcast episodes and series.
            </HeroDescription>
            <HeroStats variant="body3">
              {`${formatApproxCount(totalSeries)} series  •  ${formatApproxCount(totalEpisodes)} episodes  •  Updated daily`}
            </HeroStats>
          </PodcastContainer>
        </HeroSection>

        <SectionDivider />

        <PodcastContainer>
          {nowPlaying && nowPlaying.resource_type === "podcast_episode" && (
            <Section style={{ paddingTop: "0" }}>
              <NowPlayingHeader>
                <NowPlayingTitleWrap>
                  <NowPlayingLabel variant="subtitle2">
                    NOW PLAYING
                  </NowPlayingLabel>
                </NowPlayingTitleWrap>
              </NowPlayingHeader>
              <NowPlayingCard>
                {nowPlaying.image?.url && (
                  <NowPlayingImage
                    src={nowPlaying.image.url}
                    alt={
                      nowPlaying.image.alt ??
                      nowPlaying.title ??
                      "Podcast episode cover"
                    }
                  />
                )}
                <NowPlayingBody>
                  <FeaturedBadge>FEATURED</FeaturedBadge>
                  <NowPlayingTitle variant="h4">
                    {/* {nowPlaying.title} */}
                    Shifting AI From Fear to Optimism: U.S. Department of Labor’s Taylor Stockton
                  </NowPlayingTitle>
                  
                    <NowPlayingMeta variant="subtitle1">
                      Chalk Radio  •  OCW
                    </NowPlayingMeta>
                  
                  <NowPlayingBottom>
                    {nowPlaying.description && (
                      <NowPlayingDescription variant="body2">
                        {/* {nowPlaying.description} */}
                        March 24, 2026 / AI’s real impact depends less on technological breakthroughs and more on the economic incentives, institutional choices, and human-centered paths we choose to pursue.
                      </NowPlayingDescription>
                    )}
                    <NowPlayingRight>
                      <PlayEpisodeButton
                        variant="primary"
                        startIcon={
                          nowPlayingIsPlaying ? (
                            <RiPauseFill />
                          ) : (
                            <RiPlayFill />
                          )
                        }
                        disabled={!getEpisodeAudioUrl(nowPlaying)}
                        onClick={() => {
                          if (nowPlayingIsPlaying) {
                            playerRef.current?.pause()
                          } else {
                            handlePlayClick(nowPlaying)
                          }
                        }}
                      >
                        {nowPlayingIsPlaying ? "Pause episode" : "Play episode"}
                      </PlayEpisodeButton>
                      {(nowPlayingDuration || nowPlayingDate) && (
                        <NowPlayingDuration variant="body3">
                          {[
                            nowPlayingDuration
                              ? `${nowPlayingDuration} min`
                              : null,
                            nowPlayingDate,
                          ]
                            .filter(Boolean)
                            .join("  •  ")}
                        </NowPlayingDuration>
                      )}
                    </NowPlayingRight>
                  </NowPlayingBottom>
                </NowPlayingBody>
              </NowPlayingCard>
            </Section>
          )}

          <Section>
            <SectionHeader>
              <SectionTitle variant="subtitle1">Latest Episodes</SectionTitle>
              <SectionLink variant="subtitle1">All episodes</SectionLink>
            </SectionHeader>
            {latestEpisodes.length > 0 && (
              <EpisodeList role="list">
                {latestEpisodes.map((episode) => {
                  const parentPodcastId = getEpisodeParentPodcastId(episode)
                  return (
                    <EpisodeItem
                      role="listitem"
                      key={episode.id}
                      isMobile={isMobile}
                      episode={episode}
                      overline={episode.offered_by?.name}
                      href={
                        parentPodcastId
                          ? podcastEpisodePageView(
                              String(episode.id),
                              String(parentPodcastId),
                              episode.title,
                            )
                          : "#"
                      }
                      onPlayClick={handlePlayClick}
                      onPauseClick={() => playerRef.current?.pause()}
                      isPlaying={
                        playingEpisode?.id === episode.id && isAudioPlaying
                      }
                      isPlayable={Boolean(getEpisodeAudioUrl(episode))}
                    />
                  )
                })}
              </EpisodeList>
            )}
            {hasMoreEpisodes && (
              <LoadMoreContainer>
                <LoadMoreEpisodeButton
                  variant="secondary"
                  onClick={() =>
                    setEpisodesLimit((limit) => limit + EPISODES_PAGE_SIZE)
                  }
                  disabled={isFetchingEpisodes}
                >
                  {isFetchingEpisodes ? "Loading..." : "Load more episodes"}
                </LoadMoreEpisodeButton>
              </LoadMoreContainer>
            )}
          </Section>

          <Section style={{ paddingBottom: isMobile ? "32px" : "80px" }}>
            <SectionHeader>
              <SectionTitle variant="subtitle1">
                Podcasts across MIT
              </SectionTitle>
              <Link href={SEARCH_PODCASTS}>
                <SectionLink variant="subtitle1">All podcasts</SectionLink>
              </Link>
            </SectionHeader>
            <SeriesDescription variant="subtitle1">
              Departments, labs, and centers across MIT produce their own
              audio series. Each reflects a different part of the Institute.
            </SeriesDescription>

            <SeriesGroup>
              {featuredSeries.length > 0 && (
                <div>
                  <FeaturedLabel variant="subtitle2">FEATURED</FeaturedLabel>
                  <FeaturedSeriesRow>
                    {featuredSeries.map((item) => {
                      const episodeCount =
                        item.resource_type === "podcast"
                          ? item.podcast?.episode_count
                          : null
                      const updated = item.last_modified
                        ? formatDate(item.last_modified, "MMM D")
                        : null
                      return (
                        <FeaturedSeriesCard
                          key={item.id}
                          href={podcastPageView(String(item.id), item.title)}
                        >
                          {item.image?.url && (
                            <FeaturedSeriesImage
                              src={item.image.url}
                              alt={item.image.alt ?? item.title}
                            />
                          )}
                          <FeaturedSeriesTitle
                            className="series-card-title"
                            variant="h4"
                          >
                            {item.title}
                          </FeaturedSeriesTitle>
                          {item.description && (
                            <FeaturedSeriesSummary variant="body1">
                              {item.description}
                            </FeaturedSeriesSummary>
                          )}
                          <FeaturedSeriesMeta variant="body2">
                            {[
                              episodeCount ? `${episodeCount} episodes` : null,
                              updated ? `Updated ${updated}` : null,
                            ]
                              .filter(Boolean)
                              .join("  •  ")}
                          </FeaturedSeriesMeta>
                        </FeaturedSeriesCard>
                      )
                    })}
                  </FeaturedSeriesRow>
                </div>
              )}

              {moreSeries.length > 0 && (
                <div>
                  <SectionHeader>
                    <SectionTitle variant="subtitle1">
                      More Podcasts
                    </SectionTitle>
                  </SectionHeader>
                  {moreSeries.map((item) => {
                    const episodeCount =
                      item.resource_type === "podcast"
                        ? item.podcast?.episode_count
                        : null
                    const updated = item.last_modified
                      ? formatDate(item.last_modified, "MMM D")
                      : null
                    return (
                      <MoreSeriesRow
                        key={item.id}
                        href={podcastPageView(String(item.id), item.title)}
                      >
                        <MoreSeriesLeft>
                          <MoreSeriesTitle
                            className="series-row-title"
                            variant="h5"
                          >
                            {/* {item.title} */}
                            The Playbook, an MIT LGO podcast
                          </MoreSeriesTitle>
                          {item.offered_by?.name && (
                            <MoreSeriesOfferedBy variant="subtitle3">
                              {item.offered_by.name}
                            </MoreSeriesOfferedBy>
                          )}
                        </MoreSeriesLeft>
                        <MoreSeriesMeta variant="body3">
                          {[
                            episodeCount ? `${episodeCount} episodes` : null,
                            updated,
                          ]
                            .filter(Boolean)
                            .join("  •  ")}
                        </MoreSeriesMeta>
                      </MoreSeriesRow>
                    )
                  })}
                  {hasMoreSeries && (
                    <ViewAllContainer>
                      <ViewAllButton
                        variant="bordered"
                        endIcon={<StyledRiArrowRightLine size={24}/>}
                        href={SEARCH_PODCASTS}
                      >
                        {`View all ${formatApproxCount(totalSeries)}+ podcasts`}
                      </ViewAllButton>
                    </ViewAllContainer>
                  )}
                </div>
              )}
            </SeriesGroup>
          </Section>
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
