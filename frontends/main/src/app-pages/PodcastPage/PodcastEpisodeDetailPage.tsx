"use client"

import React, { useRef, useMemo } from "react"
import {
  Breadcrumbs,
  Typography,
  Container,
  styled,
  useMediaQuery,
} from "ol-components"
import type { Theme, TypographyProps } from "ol-components"
import { Button } from "@mitodl/smoot-design"
import { RiPlayFill, RiPauseFill } from "@remixicon/react"
import PodcastPlayer from "./PodcastPlayer"
import type { PodcastPlayerHandle } from "./PodcastPlayer"
import {
  useLearningResourcesDetail,
  useInfiniteLearningResourceItems,
} from "api/hooks/learningResources"

import { ResourceTypeEnum } from "api/v1"
import type { PodcastEpisodeResource } from "api/v1"
import moment from "moment"
import { formatDate } from "ol-utilities"
import { HOME, podcastPageView, podcastEpisodePageView } from "@/common/urls"
import { addExternalLinkTargets } from "@/common/utils"
import { EpisodeItem } from "./PodcastsListingPage/EpisodeItem"
import PodcastContainer from "./PodcastContainer"
import Link from "next/link"
import { usePodcastPlayer } from "./usePodcastPlayer"
import { getEpisodeAudioUrl } from "./PodcastsListingPage/helpers"

import PodcastShareButton from "./PodcastShareButton"
import { env } from "@/env"

const NEXT_PUBLIC_ORIGIN = env("NEXT_PUBLIC_ORIGIN")

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

const Description = styled(Typography)<Pick<TypographyProps, "component">>(
  ({ theme }) => ({
    color: theme.custom.colors.darkGray2,
    display: "block",
    marginBottom: "32px",
    marginTop: "32px",
    fontSize: "18px",
    fontStyle: "normal",
    lineHeight: "32px",
    a: {
      textDecoration: "underline",
      color: theme.custom.colors.darkGray2,
      fontWeight: theme.typography.fontWeightMedium,
    },
    "a:hover": {
      textDecoration: "none",
    },
    [theme.breakpoints.down("sm")]: {
      ...theme.typography.body1,
      lineHeight: "24px",
      marginTop: "16px",
    },
  }),
)

const EpisodeList = styled.ul({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gridTemplateColumns: "1fr",
})
const StyledPodcastShareButton = styled(PodcastShareButton)({
  padding: "18px 12px",
  margin: "0 0 24px",
})

export const BreadcrumbBar = styled.div(({ theme }) => ({
  padding: "18px 0 2px 0",
  borderBottom: `1px solid ${theme.custom.colors.red}`,
  [theme.breakpoints.down("sm")]: {
    padding: "12px 0 0 0",
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

export const PodcastShareSection = styled("div")({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "8px",
})

/* ── Component ── */

type PodcastEpisodeDetailPageProps = {
  episodeId: string
  podcastId: string | null
}

export const PodcastEpisodeDetailPage: React.FC<
  PodcastEpisodeDetailPageProps
> = ({ episodeId, podcastId }) => {
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

  const { data: episode } = useLearningResourcesDetail(Number(episodeId))

  const podcastEpisode =
    episode?.resource_type === ResourceTypeEnum.PodcastEpisode
      ? episode.podcast_episode
      : null

  // Parent podcast summary comes embedded in the episode response — prefer the
  // one matching the URL's podcastId, else fall back to the first parent.
  const parentPodcast =
    podcastEpisode?.parent_podcasts?.find((p) => p.id === Number(podcastId)) ??
    podcastEpisode?.parent_podcasts?.[0]

  const { data: episodesData } = useInfiniteLearningResourceItems(
    Number(podcastId),
    { learning_resource_id: Number(podcastId), limit: 5 },
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
  const duration = podcastEpisode?.duration
    ? Math.round(moment.duration(podcastEpisode.duration).asMinutes())
    : null

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
      ? `${NEXT_PUBLIC_ORIGIN}${podcastEpisodePageView(String(episode!.id), podcastId, episode?.title)}`
      : ""

  // Episode descriptions are sanitized on the backend with nh3 during ETL
  // (only <a href/title> is allowed), so the HTML is safe to render verbatim
  // — the same trust model as resource descriptions elsewhere. Rendering it
  // directly keeps server and client output identical, avoiding a hydration
  // mismatch; target="_blank" is added via addExternalLinkTargets so it's
  // part of the HTML fed to dangerouslySetInnerHTML on both server and
  // client, keeping SSR output byte-identical to the client's first render.
  const description = useMemo(
    () =>
      episode?.description ? addExternalLinkTargets(episode.description) : null,
    [episode?.description],
  )

  return (
    <>
      <PageSection>
        <BreadcrumbBar>
          <PodcastContainer>
            <Breadcrumbs
              variant="light"
              ancestors={[
                { href: HOME, label: "Home" },
                { href: podcastHref, label: parentPodcast?.title ?? "Podcast" },
              ]}
              current={episode?.title}
            />
          </PodcastContainer>
        </BreadcrumbBar>
        <HeaderSection hasEpisodes={episodes.length > 0}>
          <EpisodeContainer>
            {parentPodcast?.title && (
              <EpisodeLabel href={podcastHref}>
                {parentPodcast.title}
              </EpisodeLabel>
            )}

            <EpisodeTitle variant="h1">{episode?.title ?? ""}</EpisodeTitle>

            {metaParts.length > 0 && (
              <MetaLine>
                {metaParts.join("   .   ")}
                {!isMobile && <Topics> . {topicString}</Topics>}
              </MetaLine>
            )}
            {isMobile && <Topics>{topicString}</Topics>}
            <PodcastShareSection>
              {episode && podcastId && (
                <StyledButton
                  onClick={handlePlay}
                  variant="primary"
                  startIcon={
                    isCurrentEpisodePlaying ? <RiPauseFill /> : <RiPlayFill />
                  }
                  disabled={!episode || !getEpisodeAudioUrl(episode)}
                >
                  {isCurrentEpisodePlaying ? "Pause Episode" : "Play Episode"}
                </StyledButton>
              )}
              {episode && podcastId && (
                <StyledPodcastShareButton
                  resource={episode as PodcastEpisodeResource}
                  title={episode.title ?? "episode"}
                  sharePageUrl={sharePageUrl}
                />
              )}
            </PodcastShareSection>
            {description && (
              // Rendered as a <div>, not the default <p>: the sanitized
              // description contains block elements (<p>, <ul>, <li>) which are
              // invalid inside a <p>. The browser would reparent them during
              // parsing, diverging from the server HTML and breaking hydration.
              <Description
                variant="body1"
                component="div"
                dangerouslySetInnerHTML={{
                  __html: description,
                }}
              />
            )}
          </EpisodeContainer>
        </HeaderSection>
        {episodes && episodes.length > 0 && (
          <EpisodeContainer>
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
          </EpisodeContainer>
        )}
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
