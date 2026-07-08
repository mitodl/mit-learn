"use client"

import React, { useRef } from "react"
import { Breadcrumbs, Typography, styled, useMediaQuery } from "ol-components"
import type { Theme } from "ol-components"
import { Button } from "@mitodl/smoot-design"
import { RiPlayFill } from "@remixicon/react"
import PodcastPlayer from "./PodcastPlayer"
import type { PodcastPlayerHandle } from "./PodcastPlayer"
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
import { usePodcastPlayer } from "./usePodcastPlayer"
import { getEpisodeAudioUrl } from "./PodcastsListingPage/helpers"
import { EpisodeItem } from "./PodcastsListingPage/EpisodeItem"

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

const EpisodesSection = styled("div", {
  shouldForwardProp: (prop) => prop !== "hasMoreEpisodes",
})<{ hasMoreEpisodes?: boolean }>(({ theme, hasMoreEpisodes }) => ({
  padding: hasMoreEpisodes ? "0 48px" : "0 48px 40px 48px",
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
  margin: 0,
  padding: 0,
  display: "grid",
  gridTemplateColumns: "1fr",
})

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

const PageSection = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
}))

/* ── Page ── */

type PodcastDetailPageProps = {
  podcastId: string
}

const EPISODES_PAGE_SIZE = 5

export const PodcastDetailPage: React.FC<PodcastDetailPageProps> = ({
  podcastId,
}) => {
  const id = Number(podcastId)
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

  const handlePlayClick = (episode: LearningResource) =>
    toggle(episode, resource?.title)

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
          <EpisodesSection hasMoreEpisodes={!!hasNextPage}>
            <EpisodesHeading variant="subtitle3">Episodes</EpisodesHeading>

            {episodes && episodes.length > 0 && (
              <EpisodeList role="list">
                {episodes.map((episode) => (
                  <EpisodeItem
                    role="listitem"
                    key={episode.id}
                    isMobile={isMobile}
                    episode={episode}
                    href={podcastEpisodePageView(
                      String(episode.id),
                      String(id),
                      episode.title,
                    )}
                    onPlayClick={handlePlayClick}
                    onPauseClick={pause}
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
          onClose={close}
          onPlayStateChange={setIsAudioPlaying}
        />
      )}
    </>
  )
}
