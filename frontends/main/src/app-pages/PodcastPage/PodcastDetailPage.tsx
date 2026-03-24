"use client"

import React, { useState, useRef } from "react"
import {
  styled,
  Container,
  Breadcrumbs,
  Stack,
  Grid2,
  Typography,
  Skeleton,
} from "ol-components"
import { RiMailLine, RiPlayCircleFill } from "@remixicon/react"
import {
  useLearningResourcesDetail,
  learningResourceQueries,
} from "api/hooks/learningResources"
import { useQuery } from "@tanstack/react-query"
import { PodcastEpisodeResource, PodcastResource } from "api"
import { formatDate, formatDurationClockTime } from "ol-utilities"
import PodcastBannerBackground from "./PodcastBannerBackground"
import PodcastSubscribePopover from "./PodcastSubscribePopover"
import PodcastPlayer, {
  PodcastPlayerHandle,
  PodcastTrack,
} from "./PodcastPlayer"
import { HOME as HOME_URL, PODCAST as PODCASTS_URL } from "@/common/urls"

// ─── Styles ───────────────────────────────────────────────────────────────────

const SubscriptionButtonContainer = styled.div(({ theme }) => ({
  position: "relative",
  minHeight: "38px",
  display: "flex",
  marginTop: "32px",
  [theme.breakpoints.down("sm")]: {
    marginTop: "24px",
  },
}))

const BannerTitle = styled("h1")(({ theme }) => ({
  color: theme.custom.colors.lightRed,
  ...theme.typography.h1,
  margin: 0,
  [theme.breakpoints.down("md")]: {
    ...theme.typography.h2,
  },
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h3,
    marginTop: "8px",
  },
}))

const BannerContent = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
  },
}))

const LeftGrid = styled(Grid2)({
  alignItems: "center",
  display: "flex",
})

const PodcastCoverImage = styled("img")(({ theme }) => ({
  width: "100%",
  maxWidth: "410px",
  height: "auto",
  borderRadius: "8px",
  objectFit: "cover",
  display: "block",
  [theme.breakpoints.down("md")]: {
    maxWidth: "200px",
    marginTop: "24px",
  },
  [theme.breakpoints.down("sm")]: {
    maxWidth: "160px",
  },
}))

const EpisodesSection = styled.div(({ theme }) => ({
  padding: "48px 0 64px",
  backgroundColor: theme.custom.colors.lightGray1,
  [theme.breakpoints.down("md")]: {
    padding: "32px 0 40px",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "24px 0 40px",
  },
}))

const EpisodesSectionHeader = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "24px",
  [theme.breakpoints.down("sm")]: {
    marginBottom: "16px",
  },
}))

const SortSelect = styled("select")(({ theme }) => ({
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "4px",
  padding: "6px 12px",
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
  backgroundColor: theme.custom.colors.white,
  cursor: "pointer",
  outline: "none",
  "&:focus": {
    borderColor: theme.custom.colors.darkGray2,
  },
}))

const EpisodeList = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "0px",
})

const EpisodeRow = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  padding: "24px",
  backgroundColor: theme.custom.colors.white,
  gap: "24px",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  "&:last-child": {
    borderBottom: "none",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "16px 0",
    gap: "16px",
  },
}))

const EpisodeInfo = styled.div({
  flex: 1,
  minWidth: 0,
})

const EpisodeTitle = styled("button")(({ theme }) => ({
  background: "none",
  border: "none",
  padding: 0,
  textAlign: "left",
  cursor: "pointer",
  ...theme.typography.subtitle1,
  color: theme.custom.colors.darkGray2,
  marginBottom: "8px",
  display: "block",
  width: "100%",
  "&:hover": {
    color: theme.custom.colors.mitRed,
  },
}))

const EpisodeDescription = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray1,
  ...theme.typography.body2,
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  marginBottom: "12px",
  [theme.breakpoints.down("sm")]: {
    WebkitLineClamp: 3,
  },
}))

const EpisodeMeta = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap",
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray1,
}))

const MetaSeparator = styled.span(({ theme }) => ({
  color: theme.custom.colors.lightGray2,
}))

const PlayButton = styled("button")<{ $isPlaying?: boolean }>(
  ({ theme, $isPlaying }) => ({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexShrink: 0,
    background: "none",
    border: "none",
    padding: "4px 0",
    cursor: "pointer",
    ...theme.typography.body3,
    color: $isPlaying
      ? theme.custom.colors.mitRed
      : theme.custom.colors.darkGray1,
    "&:hover": {
      color: theme.custom.colors.mitRed,
    },
  }),
)

const DescriptionText = styled("p")(({ theme }) => ({
  color: theme.custom.colors.white,
  ...theme.typography.body1,
  margin: 0,
  marginTop: "32px",
  [theme.breakpoints.down("md")]: {
    ...theme.typography.body2,
  },
}))

const PlayButtonIcon = styled(RiPlayCircleFill)<{ $isPlaying?: boolean }>(
  ({ theme, $isPlaying }) => ({
    color: $isPlaying
      ? theme.custom.colors.mitRed
      : theme.custom.colors.silverGrayLight,
  }),
)

// ─── Sort options ─────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { label: "Newest", value: "-id" },
  { label: "Oldest", value: "id" },
] as const

type SortValue = (typeof SORT_OPTIONS)[number]["value"]

// ─── Episode row ──────────────────────────────────────────────────────────────

const EpisodeItem: React.FC<{
  episode: PodcastEpisodeResource
  isPlaying: boolean
  onPlay: () => void
}> = ({ episode, isPlaying, onPlay }) => {
  const dateStr = episode.last_modified ?? null
  const duration = episode.podcast_episode?.duration
  return (
    <EpisodeRow>
      <EpisodeInfo>
        <EpisodeTitle onClick={onPlay}>{episode.title}</EpisodeTitle>
        {episode.description ? (
          <EpisodeDescription>{episode.description}</EpisodeDescription>
        ) : null}
        <EpisodeMeta>
          {dateStr ? <span>{formatDate(dateStr, "MMMM Do, YYYY")}</span> : null}
          {dateStr && duration ? <MetaSeparator>·</MetaSeparator> : null}
          {duration ? <span>{formatDurationClockTime(duration)}</span> : null}
        </EpisodeMeta>
      </EpisodeInfo>
      {episode.podcast_episode?.audio_url ? (
        <PlayButton
          aria-label={
            isPlaying ? `Pause ${episode.title}` : `Play ${episode.title}`
          }
          $isPlaying={isPlaying}
          onClick={onPlay}
        >
          <PlayButtonIcon $isPlaying={isPlaying} size={40} />
        </PlayButton>
      ) : null}
    </EpisodeRow>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PodcastDetailPageProps {
  podcastId: string | number
}

export const PodcastDetailPage: React.FC<PodcastDetailPageProps> = ({
  podcastId,
}) => {
  const id = Number(podcastId)
  const [sortby, setSortby] = useState<SortValue>("-id")
  const [activeTrack, setActiveTrack] = useState<PodcastTrack | null>(null)
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false)
  const playerRef = useRef<PodcastPlayerHandle>(null)

  const { data: resource, isLoading: isLoadingPodcast } =
    useLearningResourcesDetail(id)

  const podcast =
    resource?.resource_type === "podcast"
      ? (resource as PodcastResource)
      : undefined

  const { data: episodes, isLoading: isLoadingEpisodes } = useQuery({
    ...learningResourceQueries.items(id, { learning_resource_id: id, sortby }),
    enabled: !!id,
  })

  const podcastEpisodes = (episodes ?? []) as PodcastEpisodeResource[]

  return (
    <>
      <PodcastBannerBackground>
        <Breadcrumbs
          variant="dark"
          ancestors={[
            { href: HOME_URL, label: "Home" },
            { href: PODCASTS_URL, label: "Podcasts" },
          ]}
          current={
            isLoadingPodcast ? "Loading..." : (podcast?.title ?? "Podcast")
          }
        />
        <BannerContent>
          <Grid2
            container
            spacing={{ xs: 2, sm: 2, md: 10 }}
            style={{ width: "100%" }}
          >
            <LeftGrid size={{ xs: 12, sm: 7, md: 8 }}>
              <Stack>
                {isLoadingPodcast ? (
                  <Skeleton variant="text" width={300} height={60} />
                ) : (
                  <BannerTitle>{podcast?.title}</BannerTitle>
                )}
                {isLoadingPodcast ? (
                  <Skeleton
                    variant="text"
                    width="100%"
                    height={80}
                    sx={{ mt: 1 }}
                  />
                ) : podcast?.description ? (
                  <DescriptionText>{podcast.description}</DescriptionText>
                ) : null}
                <SubscriptionButtonContainer>
                  <PodcastSubscribePopover
                    buttonLabel="Subscribe to new episodes"
                    buttonIcon={<RiMailLine size={20} />}
                    podcastUrl={
                      podcast?.podcast?.apple_podcasts_url ?? undefined
                    }
                    rssUrl={podcast?.podcast?.rss_url ?? undefined}
                  />
                </SubscriptionButtonContainer>
              </Stack>
            </LeftGrid>
            {podcast?.image?.url ? (
              <Grid2
                size={{ xs: 12, sm: 5, md: 4 }}
                style={{ display: "flex", justifyContent: "center" }}
              >
                <PodcastCoverImage
                  src={podcast.image.url}
                  alt={podcast.image.alt ?? podcast.title}
                />
              </Grid2>
            ) : null}
          </Grid2>
        </BannerContent>
      </PodcastBannerBackground>

      <EpisodesSection>
        <Container>
          <EpisodesSectionHeader>
            <Typography variant="h2">Episodes</Typography>
            <label>
              <SortSelect
                value={sortby}
                onChange={(e) => setSortby(e.target.value as SortValue)}
                aria-label="Sort episodes"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    Sort by: {opt.label}
                  </option>
                ))}
              </SortSelect>
            </label>
          </EpisodesSectionHeader>

          {isLoadingEpisodes ? (
            <EpisodeList>
              {Array.from({ length: 5 }).map((_, i) => (
                <EpisodeRow key={i}>
                  <EpisodeInfo>
                    <Skeleton variant="text" width="60%" height={28} />
                    <Skeleton variant="text" width="90%" height={20} />
                    <Skeleton variant="text" width="40%" height={16} />
                  </EpisodeInfo>
                </EpisodeRow>
              ))}
            </EpisodeList>
          ) : (
            <EpisodeList>
              {podcastEpisodes.map((episode) => {
                const audioUrl = episode.podcast_episode?.audio_url
                const isPlaying =
                  !!audioUrl &&
                  activeTrack?.audioUrl === audioUrl &&
                  isActuallyPlaying
                return (
                  <EpisodeItem
                    key={episode.id}
                    episode={episode}
                    isPlaying={isPlaying}
                    onPlay={() => {
                      if (!audioUrl) return
                      if (activeTrack?.audioUrl === audioUrl) {
                        playerRef.current?.togglePlayPause()
                      } else {
                        setActiveTrack({
                          audioUrl,
                          title: episode.title,
                          podcastName: podcast?.title ?? "",
                        })
                      }
                    }}
                  />
                )
              })}
            </EpisodeList>
          )}
        </Container>
      </EpisodesSection>

      {activeTrack ? (
        <PodcastPlayer
          ref={playerRef}
          track={activeTrack}
          onPlayStateChange={setIsActuallyPlaying}
          onClose={() => {
            setActiveTrack(null)
            setIsActuallyPlaying(false)
          }}
        />
      ) : null}
    </>
  )
}
