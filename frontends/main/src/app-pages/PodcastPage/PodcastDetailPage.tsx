"use client"

import React, { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Breadcrumbs, Typography, styled } from "ol-components"
import { ButtonLink, Button } from "@mitodl/smoot-design"
import { RiPlayFill } from "@remixicon/react"
import PodcastPlayer from "./PodcastPlayer"
import type { PodcastTrack } from "./PodcastPlayer"
import { useQuery } from "@tanstack/react-query"
import {
  useLearningResourcesDetail,
  learningResourceQueries,
} from "api/hooks/learningResources"
import { ResourceTypeEnum } from "api/v1"
import type { LearningResource } from "api/v1"
import moment from "moment"
import { formatDate } from "ol-utilities"
import { HOME } from "@/common/urls"
import PodcastContainer from "./PodcastContainer"

const LearningResourceDrawer = dynamic(
  () =>
    import("@/page-components/LearningResourceDrawer/LearningResourceDrawer"),
)

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
  marginBottom: "16px",
  display: "inline-block",

  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h3,
    fontSize: "34px",
    fontStyle: "normal",
    lineHeight: "40px",
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
  width: "280px",
  height: "280px",
  objectFit: "cover",
  borderRadius: "8px",
  flexShrink: 0,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  [theme.breakpoints.down("sm")]: {
    width: "calc(100% + 32px)",
    marginLeft: "-16px",
    marginRight: "-16px",
    height: "auto",
    aspectRatio: "1 / 1",
    borderRadius: "0px",
    marginBottom: "-10px",
  },
}))

const HeaderContent = styled.div(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "12.95fr 0.6fr",
  gap: "164px",
  "& .mobile-title": {
    display: "none",
  },
  "& .desktop-title": {
    display: "inline-block",
  },

  [theme.breakpoints.down("sm")]: {
    display: "flex",
    flexDirection: "column-reverse",
    gap: "0px",
    "& .mobile-title": {
      display: "inline-block",
    },
    "& .desktop-title": {
      display: "none",
    },
  },
}))

const HeaderTextContent = styled.div(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {},
}))

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

const EpisodeList = styled.ul({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gridTemplateColumns: "1fr",
})

const EpisodeRow = styled.li(({ theme }) => ({
  margin: 0,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "28px 16px",
  boxShadow: `0 -1px 0 ${theme.custom.colors.lightGray2}`,
  gap: "16px",
  "&:last-child": {
    boxShadow: `0 -1px 0 ${theme.custom.colors.lightGray2}, 0 1px 0 ${theme.custom.colors.lightGray2}`,
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
  marginBottom: "8px",
  fontSize: "18px",
  fontStyle: "normal",
  fontWeight: theme.typography.fontWeightBold,
  lineHeight: "26px",
}))

const StyledButton = styled(ButtonLink)(({ theme }) => ({
  minWidth: "140px",
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

const BreadcrumbBar = styled.div(({ theme }) => ({
  padding: "32px 0 16px 0",
  borderBottom: `2px solid ${theme.custom.colors.red}`,
  [theme.breakpoints.down("sm")]: {
    padding: "16px 0 0px 0",
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

interface PlayButtonProps {
  $isPlaying?: boolean
}

const PlayButton = styled.a<PlayButtonProps>(({ theme, $isPlaying }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "48px",
  height: "48px",
  border: `1.5px solid ${$isPlaying ? "#E63946" : theme.custom.colors.darkGray2}`,
  borderRadius: "4px",
  color: $isPlaying ? "#E63946" : theme.custom.colors.darkGray2,
  backgroundColor: $isPlaying ? "#FFE8EB" : "transparent",
  textDecoration: "none",
  flexShrink: 0,
  cursor: "pointer",
  "&:hover": {
    backgroundColor: $isPlaying ? "#FFD4DC" : theme.custom.colors.lightGray2,
  },

  [theme.breakpoints.down("sm")]: {
    width: "80px",
    height: "48px",
  },
}))

/* ── Episode row component ── */

type EpisodeItemProps = {
  episode: LearningResource
  index: number
  onPlayClick: (episode: LearningResource) => void
  isPlaying: boolean
}

const EpisodeItem: React.FC<EpisodeItemProps> = ({
  episode,
  onPlayClick,
  isPlaying,
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
    <EpisodeRow>
      <EpisodeInfo>
        <EpisodeTitleLink>{episode.title}</EpisodeTitleLink>
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
          as="button"
          onClick={() => onPlayClick(episode)}
          aria-label={`Play ${episode.title}`}
          $isPlaying={isPlaying}
        >
          <RiPlayFill size={20} />
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
  const id = Number(podcastId)
  const [offset, setOffset] = useState(0)
  const [allEpisodes, setAllEpisodes] = useState<LearningResource[]>([])
  const [playingEpisode, setPlayingEpisode] = useState<LearningResource | null>(
    null,
  )
  const [shouldLoadMore, setShouldLoadMore] = useState(true)

  const { data: resource } = useLearningResourcesDetail(id)

  const {
    data: episodesPage,
    isLoading: episodesLoading,
    isFetching: episodesFetching,
  } = useQuery({
    ...learningResourceQueries.items(id, {
      learning_resource_id: id,
      limit: EPISODES_PAGE_SIZE,
      offset,
    }),
    enabled: !!resource,
  })

  useEffect(() => {
    if (!episodesPage) {
      return
    }
    setAllEpisodes((prev) => {
      if (offset === 0) {
        return episodesPage
      }
      const existingIds = new Set(prev.map((episode) => episode.id))
      const nextEpisodes = episodesPage.filter(
        (episode) => !existingIds.has(episode.id),
      )
      return [...prev, ...nextEpisodes]
    })
    // If we received fewer items than requested, we've reached the end
    if (episodesPage.length < EPISODES_PAGE_SIZE) {
      setShouldLoadMore(false)
    }
  }, [episodesPage, offset])

  const hasMore =
    shouldLoadMore && (episodesPage?.length ?? 0) === EPISODES_PAGE_SIZE
  const episodes = allEpisodes

  const isPodcast =
    resource?.resource_type === ResourceTypeEnum.Podcast &&
    resource.resource_type === "podcast"
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
  const latestEpisodeDuration =
    latestEpisode?.resource_type === "podcast_episode" &&
    latestEpisode.podcast_episode?.duration
      ? Math.round(
          moment.duration(latestEpisode.podcast_episode.duration).asMinutes(),
        )
      : null
  const latestEpisodeDate = latestEpisode?.last_modified
    ? formatDate(latestEpisode.last_modified, "MMM D")
    : null

  const subscribeUrl =
    podcast?.apple_podcasts_url ??
    podcast?.google_podcasts_url ??
    podcast?.rss_url

  const handlePlayClick = (episode: LearningResource) => {
    setPlayingEpisode(episode)
  }

  const currentTrack: PodcastTrack | null = playingEpisode
    ? {
        audioUrl:
          (playingEpisode.resource_type === "podcast_episode" &&
            playingEpisode.podcast_episode?.audio_url) ||
          (playingEpisode.resource_type === "podcast_episode" &&
            playingEpisode.podcast_episode?.episode_link) ||
          "",
        title: playingEpisode.title || "Untitled Episode",
        podcastName: resource?.title || "Podcast",
      }
    : null

  return (
    <>
      <LearningResourceDrawer />
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
                <HeaderTextContent>
                  <PodcastTitle variant="h1" className="desktop-title">
                    {resource?.title ?? ""}
                  </PodcastTitle>
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

                  {subscribeUrl && (
                    <StyledButton
                      href={subscribeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="primary"
                      startIcon={<RiPlayFill />}
                    >
                      Play Latest Episode
                    </StyledButton>
                  )}
                </HeaderTextContent>

                {resource?.image?.url && (
                  <PodcastImage
                    src={resource.image.url}
                    alt={
                      resource.image.alt ?? resource.title ?? "Podcast cover"
                    }
                  />
                )}
                <PodcastTitle variant="h1" className="mobile-title">
                  {resource?.title ?? ""}
                </PodcastTitle>
              </HeaderContent>
            </StyledHeaderSection>
          </PodcastContainer>
        </HeaderSection>

        <PodcastContainer>
          <EpisodesSection>
            <EpisodesHeading variant="subtitle3">Episodes</EpisodesHeading>

            {episodes && episodes.length > 0 && (
              <EpisodeList>
                {episodes.map((episode, index) => (
                  <EpisodeItem
                    key={episode.id}
                    episode={episode}
                    index={index}
                    onPlayClick={handlePlayClick}
                    isPlaying={playingEpisode?.id === episode.id}
                  />
                ))}
              </EpisodeList>
            )}
            {(hasMore || episodesLoading) && (
              <StyledShowMoreContainer>
                <StyledShowMore
                  variant="secondary"
                  onClick={() => setOffset((o) => o + EPISODES_PAGE_SIZE)}
                  disabled={episodesFetching}
                >
                  {episodesFetching ? "Loading..." : "Load more episodes"}
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
          track={currentTrack}
          onClose={() => setPlayingEpisode(null)}
        />
      )}
    </>
  )
}
