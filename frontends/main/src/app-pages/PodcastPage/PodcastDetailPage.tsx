"use client"

import React from "react"
import { Typography, Skeleton, styled } from "ol-components"
import { Button } from "@mitodl/smoot-design"
import { RiPlayFill, RiPauseFill } from "@remixicon/react"
import {
  useLearningResourcesDetail,
  useInfiniteLearningResourceItems,
} from "api/hooks/learningResources"
import { ResourceTypeEnum } from "api/v1"
import type { LearningResource } from "api/v1"
import { formatDate } from "ol-utilities"
import { HOME, podcastEpisodePageView } from "@/common/urls"
import PodcastContainer from "./PodcastContainer"
import PodcastBreadcrumbs from "./PodcastBreadcrumbs"
import { usePodcastPage } from "./usePodcastPage"
import {
  getEpisodeAudioUrl,
  getEpisodeDurationMinutes,
} from "./PodcastsListingPage/helpers"
import { EpisodeItem } from "./PodcastsListingPage/EpisodeItem"
import { EPISODES_PAGE_SIZE } from "./PodcastsListingPage/constants"
import {
  PageSection,
  EpisodeList,
  PlayButton,
  SectionMessage,
} from "./PodcastsListingPage/styled"

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

const StyledButton = styled(PlayButton)(({ theme }) => ({
  padding: "16px 20px",
  ...theme.typography.body1,
  fontWeight: theme.typography.fontWeightMedium,
  lineHeight: "16px",
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

const StyledPauseIcon = styled(RiPauseFill)({
  width: "24px !important",
  height: "24px !important",
})

const SkeletonLine = styled(Skeleton)({
  marginBottom: "16px",
})

const PodcastHeaderSkeleton = () => (
  <>
    <SkeletonLine variant="text" width="60%" height={48} />
    <SkeletonLine variant="text" width="40%" height={22} />
    <SkeletonLine variant="text" width="100%" height={20} />
    <SkeletonLine variant="text" width="90%" height={20} />
    <SkeletonLine variant="rectangular" width={200} height={48} />
  </>
)

const EpisodesSkeleton = () => (
  <div>
    {Array.from({ length: EPISODES_PAGE_SIZE }, (_unused, i) => (
      <SkeletonLine key={i} variant="text" width="55%" height={26} />
    ))}
  </div>
)

/* ── Page ── */

type PodcastDetailPageProps = {
  podcastId: string
}

export const PodcastDetailPage: React.FC<PodcastDetailPageProps> = ({
  podcastId,
}) => {
  const id = Number(podcastId)
  const { isMobile, playerBar, playingEpisode, isAudioPlaying, toggle, pause } =
    usePodcastPage()

  const {
    data: resource,
    isLoading: resourceLoading,
    isError: resourceError,
  } = useLearningResourcesDetail(id)

  const {
    data: episodesData,
    isLoading: episodesLoading,
    isError: episodesError,
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
  const isLatestEpisodePlaying =
    !!latestEpisode && playingEpisode?.id === latestEpisode.id && isAudioPlaying
  const latestEpisodeDuration = latestEpisode
    ? getEpisodeDurationMinutes(latestEpisode)
    : null
  const latestEpisodeDate = latestEpisode?.last_modified
    ? formatDate(latestEpisode.last_modified, "MMM D")
    : null

  const handlePlayClick = (episode: LearningResource) => toggle(episode, id)

  return (
    <>
      <PageSection variant="white">
        <HeaderSection>
          <PodcastBreadcrumbs
            ancestors={[{ href: HOME, label: "Home" }]}
            current={resource?.title}
          />
          <PodcastContainer>
            <StyledHeaderSection>
              {resourceLoading ? (
                <PodcastHeaderSkeleton />
              ) : resourceError ? (
                <SectionMessage variant="body1">
                  Something went wrong loading this podcast. Please try again
                  later.
                </SectionMessage>
              ) : !isPodcast ? (
                <SectionMessage variant="body1">
                  This podcast is unavailable.
                </SectionMessage>
              ) : (
                <HeaderContent>
                  <PodcastTitle variant="h1">{resource?.title}</PodcastTitle>

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
                      <MetaLine variant="body3">
                        {metaParts.join(" · ")}
                      </MetaLine>
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
                        startIcon={
                          isLatestEpisodePlaying ? (
                            <StyledPauseIcon />
                          ) : (
                            <StyledIcon />
                          )
                        }
                        disabled={!getEpisodeAudioUrl(latestEpisode)}
                      >
                        {isLatestEpisodePlaying
                          ? "Pause Latest Episode"
                          : "Play Latest Episode"}
                      </StyledButton>
                    )}
                  </HeaderTextContent>
                </HeaderContent>
              )}
            </StyledHeaderSection>
          </PodcastContainer>
        </HeaderSection>

        {!resourceError && (resourceLoading || isPodcast) && (
          <PodcastContainer>
            <EpisodesSection hasMoreEpisodes={!!hasNextPage}>
              <EpisodesHeading variant="subtitle3">Episodes</EpisodesHeading>

              {resourceLoading || episodesLoading ? (
                <EpisodesSkeleton />
              ) : episodesError ? (
                <SectionMessage variant="body1">
                  Something went wrong loading episodes. Please try again later.
                </SectionMessage>
              ) : episodes.length > 0 ? (
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
              ) : (
                <SectionMessage variant="body1">
                  No episodes found.
                </SectionMessage>
              )}

              {!resourceLoading &&
                !episodesLoading &&
                !episodesError &&
                hasNextPage && (
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
            </EpisodesSection>
          </PodcastContainer>
        )}
      </PageSection>
      {playerBar}
    </>
  )
}
