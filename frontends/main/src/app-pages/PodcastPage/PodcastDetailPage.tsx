"use client"

import React, { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Breadcrumbs, Typography, styled } from "ol-components"
import { ButtonLink, Button } from "@mitodl/smoot-design"
import { RiMailLine, RiPlayFill } from "@remixicon/react"
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
import { useResourceDrawerHref } from "@/page-components/LearningResourceDrawer/useResourceDrawerHref"
import PodcastContainer from "./PodcastContainer"

const LearningResourceDrawer = dynamic(
  () =>
    import("@/page-components/LearningResourceDrawer/LearningResourceDrawer"),
)

/* ── Header ── */

const HeaderSection = styled.div(({ theme }) => ({
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  marginBottom: "56px",
  paddingTop: "64px 0",
  [theme.breakpoints.down("sm")]: {
    paddingBottom: "24px",
  },
}))

const PodcastTitle = styled(Typography)(({ theme }) => ({
  marginBottom: "16px",
  display: "inline-block",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h3,
  },
}))

const StyledHeaderSection = styled.div({
  padding: "64px 0",
})

const MetaLine = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  marginBottom: "16px",
  display: "block",
  ...theme.typography.body1,
  lineHeight: "26px",
}))

const Description = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  display: "block",
  marginBottom: "16px",
  ...theme.typography.body1,
  lineHeight: "26px",
}))

const LatestEpisodeLine = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  marginBottom: "16px",
  ...theme.typography.body1,
  lineHeight: "26px",
}))

const PodcastImage = styled.img({
  width: "280px",
  height: "280px",
  objectFit: "cover",
  borderRadius: "8px",
  flexShrink: 0,
})

const HeaderContent = styled.div(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "12.95fr 0.6fr",
  gap: "164px",
  [theme.breakpoints.down("sm")]: {
    display: "flex",
    flexDirection: "column-reverse",
    gap: "20px",
  },
}))

/* ── Episodes list ── */

const EpisodesSection = styled.div({
  paddingBottom: "80px",
  padding: "0 48px",
})

const EpisodesHeading = styled(Typography)(({ theme }) => ({
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  color: theme.custom.colors.silverGrayDark,
  ...theme.typography.body3,
  marginBottom: "24px",
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
  padding: "24px 16px",
  boxShadow: `0 -1px 0 ${theme.custom.colors.lightGray2}`,
  gap: "16px",
  "&:last-child": {
    boxShadow: `0 -1px 0 ${theme.custom.colors.lightGray2}, 0 1px 0 ${theme.custom.colors.lightGray2}`,
  },
}))

const EpisodeInfo = styled.div({
  flex: 1,
  minWidth: 0,
})

const EpisodeLabel = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  marginBottom: "8px",
}))

const EpisodeTitleLink = styled.a(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.darkGray2,
  textDecoration: "none",
  display: "block",
  marginBottom: "8px",
  fontSize: "18px",
  fontStyle: "normal",
  fontWeight: theme.typography.fontWeightBold,
  lineHeight: "26px",
  "&:hover": {
    textDecoration: "underline",
  },
}))

const EpisodeDescription = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  ...theme.typography.body1,
  lineHeight: "20px",
}))

const StyledButton = styled(ButtonLink)({
  minWidth: "140px",
})

const StyledShowMoreContainer = styled("div")({
  width: "100%",
  display: "flex",
  justifyContent: "center",
})
const StyledShowMore = styled(Button)({
  minWidth: "140px",
  margin: "40px 0 56px 0"
})

const BreadcrumbBar = styled.div(({ theme }) => ({
  padding: "32px 0 16px 0",
  borderBottom: `2px solid ${theme.custom.colors.red}`,
  [theme.breakpoints.down("sm")]: {
    padding: "16px 0 0px 0",
  },
}))

const EpisodeRight = styled.div({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "28px",
  flexShrink: 0,
})

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

const PlayButton = styled.a(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "48px",
  height: "48px",
  border: `1.5px solid ${theme.custom.colors.darkGray2}`,
  borderRadius: "4px",
  color: theme.custom.colors.darkGray2,
  textDecoration: "none",
  flexShrink: 0,
  cursor: "pointer",
  "&:hover": {
    backgroundColor: theme.custom.colors.lightGray2,
  },
}))

/* ── Episode row component ── */

type EpisodeItemProps = {
  episode: LearningResource
  index: number
}

const EpisodeItem: React.FC<EpisodeItemProps> = ({ episode, index }) => {
  const getDrawerHref = useResourceDrawerHref()
  const drawerHref = getDrawerHref(episode.id)

  const podcastEpisode =
    episode.resource_type === "podcast_episode" ? episode.podcast_episode : null

  const duration = podcastEpisode?.duration
    ? Math.round(moment.duration(podcastEpisode.duration).asMinutes())
    : null

  const date = episode.last_modified
    ? formatDate(episode.last_modified, "MMM D")
    : null

  const metaParts = [duration ? `${duration} min` : null, date].filter(Boolean)

  const audioUrl = podcastEpisode?.audio_url ?? podcastEpisode?.episode_link

  return (
    <EpisodeRow>
      <EpisodeInfo>
        <EpisodeLabel variant="body3">
          {episode.readable_id || `Episode ${index + 1}`}
        </EpisodeLabel>
        <EpisodeTitleLink href={drawerHref}>
          Where We’ve Been and Where We’re Going
        </EpisodeTitleLink>
        {episode.description && (
          <EpisodeDescription variant="body3">
            {/* {episode.description} */}
            The team reflects on four seasons of climate conversations and
            what's ahead.
          </EpisodeDescription>
        )}
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
          href={audioUrl ?? drawerHref}
          target={audioUrl ? "_blank" : undefined}
          rel={audioUrl ? "noopener noreferrer" : undefined}
          aria-label={`Play ${episode.title}`}
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

  const { data: resource } = useLearningResourcesDetail(id)

  const { data: episodesPage, isLoading: episodesLoading, isFetching: episodesFetching } = useQuery({
    ...learningResourceQueries.items(id, {
      learning_resource_id: id,
      limit: EPISODES_PAGE_SIZE,
      offset,
    }),
    enabled: !!resource,
  })

  useEffect(() => {
    if (episodesPage) {
      setAllEpisodes((prev) => [...prev, ...episodesPage])
    }
  }, [episodesPage])

  const hasMore = (episodesPage?.length ?? 0) === EPISODES_PAGE_SIZE
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
    episodeCount ? `MIT OpenCourseWare ·${episodeCount} episodes` : null,
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

  return (
    <>
      <LearningResourceDrawer />
      <PageSection>
        <HeaderSection>
          <BreadcrumbBar>
            <PodcastContainer>
              <Breadcrumbs
                variant="light"
                ancestors={[
                  { href: HOME, label: "Home" },
                  { href: "/podcasts", label: "Podcasts" },
                ]}
                current={resource?.title}
              />
            </PodcastContainer>
          </BreadcrumbBar>
          <PodcastContainer>
            <StyledHeaderSection>
              <HeaderContent>
                <div>
                  <PodcastTitle variant="h1">
                    {/* {resource?.title ?? ""} */}
                    Chalk Radio
                  </PodcastTitle>

                  {metaParts.length > 0 && (
                    <MetaLine variant="body3">{metaParts.join(" · ")}</MetaLine>
                  )}

                  {resource?.description && (
                    <Description variant="body2">
                      {/* {resource.description} */}
                      An MIT OpenCourseWare podcast about inspired teaching. We
                      take you behind the scenes of some of the most interesting
                      courses on campus to talk with the professors who make
                      those courses possible. Listen in on conversations about
                      cutting-edge research and innovative pedagogy.
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
                      startIcon={<RiMailLine />}
                    >
                      Subscribe
                    </StyledButton>
                  )}
                </div>

                {resource?.image?.url && (
                  <PodcastImage
                    src={resource.image.url}
                    alt={
                      resource.image.alt ?? resource.title ?? "Podcast cover"
                    }
                  />
                )}
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
    </>
  )
}
