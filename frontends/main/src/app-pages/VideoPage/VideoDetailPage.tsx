"use client"

import React from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import Image from "next/image"
import {
  Container,
  Typography,
  styled,
  theme,
  Skeleton,
  Breadcrumbs,
} from "ol-components"
import { useQuery } from "@tanstack/react-query"
import {
  useLearningResourcesDetail,
  learningResourceQueries,
  videoPlaylistQueries,
} from "api/hooks/learningResources"
import type { VideoResource, VideoPlaylistResource } from "api/v1"
import { VideoResourceResourceTypeEnum } from "api/v1"
import { formatDurationClockTime } from "ol-utilities"
import { resolveVideoSources } from "./videoSources"
import type { VideoJsPlayerProps } from "./VideoJsPlayer"

// Lazy-load the video.js player only when the page mounts
const VideoJsPlayer = dynamic<VideoJsPlayerProps>(
  () => import("./VideoJsPlayer"),
  { ssr: false },
)

const PageWrapper = styled.div({
  backgroundColor: "#fff",
  minHeight: "100vh",
})

const BreadcrumbBar = styled.div({
  padding: "12px 0 0 0",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  backgroundColor: "#f8f8f8",
})

const ContentArea = styled.div({
  padding: "32px 0 64px",
})

const MetaRow = styled.div({
  marginBottom: "6px",
})

const FromPlaylistLink = styled(Link)({
  ...theme.typography.body3,
  color: theme.custom.colors.red,
  textDecoration: "none",
  fontWeight: theme.typography.fontWeightMedium,
  "&:hover": { textDecoration: "underline" },
})

const OfferedByBadge = styled.span({
  display: "inline-block",
  ...theme.typography.body4,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.darkGray1,
  marginBottom: "8px",
})

const VideoTitle = styled.h1(({ theme }) => ({
  ...theme.typography.h3,
  color: theme.custom.colors.black,
  lineHeight: 1.15,
  marginBottom: "12px",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h4,
    marginTop: 0,
  },
}))

const VideoDescription = styled(Typography)(({ theme }) => ({
  ...theme.typography.body1,
  fontStyle: "italic",
  color: theme.custom.colors.darkGray1,
  maxWidth: "640px",
  marginBottom: "16px",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body2,
  },
}))

const AuthorRow = styled.div({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  marginBottom: "24px",
})

const AuthorName = styled(Typography)({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.black,
  fontWeight: theme.typography.fontWeightBold,
})

const DurationChip = styled.span({
  display: "inline-block",
  backgroundColor: theme.custom.colors.lightGray1,
  color: theme.custom.colors.darkGray1,
  ...theme.typography.body3,
  fontWeight: theme.typography.fontWeightMedium,
  padding: "3px 10px",
  borderRadius: "4px",
})

const PlayerWrapper = styled.div({
  width: "100%",
  aspectRatio: "16/9",
  backgroundColor: "#000",
  borderRadius: "8px",
  overflow: "hidden",
  position: "relative",
  marginBottom: "32px",

  ".video-js, .vjs-tech": {
    width: "100% !important",
    height: "100% !important",
    position: "absolute",
    top: 0,
    left: 0,
  },
})

const NoVideoMessage = styled.div({
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "rgba(255,255,255,0.5)",
  fontSize: 14,
})

const TopicsSection = styled.div({
  marginBottom: "32px",
})

const TopicsLabel = styled(Typography)({
  ...theme.typography.subtitle2,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: theme.custom.colors.darkGray1,
  marginBottom: "12px",
})

const TopicChips = styled.div({
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
})

const TopicChip = styled(Link)({
  display: "inline-block",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  color: theme.custom.colors.darkGray2,
  ...theme.typography.body3,
  padding: "6px 14px",
  borderRadius: "4px",
  textDecoration: "none",
  "&:hover": {
    backgroundColor: theme.custom.colors.lightGray1,
    borderColor: theme.custom.colors.silverGrayLight,
  },
})

const Divider = styled.hr({
  border: "none",
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
  margin: "0 0 32px",
})

const MoreFromSection = styled.div({
  marginBottom: "32px",
})

const MoreFromTitle = styled(Typography)({
  ...theme.typography.h5,
  fontWeight: theme.typography.fontWeightBold,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: theme.custom.colors.black,
  marginBottom: "20px",
})

const MoreFromList = styled.div({
  display: "flex",
  flexDirection: "column",
})

const MoreFromItem = styled(Link)({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  padding: "16px 0",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  textDecoration: "none",
  gap: "12px",
  "&:last-child": { borderBottom: "none" },
  "&:hover .more-from-title": {
    color: theme.custom.colors.red,
  },
})

const MoreFromItemLeft = styled.div({
  flex: 1,
  minWidth: 0,
})

const MoreFromItemTitle = styled(Typography)({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.black,
  fontWeight: theme.typography.fontWeightBold,
  transition: "color 0.15s",
  marginBottom: "4px",
})

const MoreFromItemMeta = styled(Typography)({
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray1,
})

const MoreFromItemDuration = styled.span({
  flexShrink: 0,
  color: theme.custom.colors.darkGray1,
  ...theme.typography.body3,
  fontWeight: theme.typography.fontWeightMedium,
})

const SeeAllLink = styled(Link)({
  display: "inline-block",
  marginTop: "16px",
  ...theme.typography.body2,
  color: theme.custom.colors.red,
  fontWeight: theme.typography.fontWeightMedium,
  textDecoration: "none",
  "&:hover": { textDecoration: "underline" },
})

const ThumbnailWrapper = styled.div({
  position: "relative",
  width: "100%",
  height: "100%",
})

const StyledBreadcrumbs = styled(Breadcrumbs)(() => ({
  "& > span": {
    paddingBottom: 0,
  },
}))

// ---------------------------------------------------------------------------
// Helper: extract instructor info
// ---------------------------------------------------------------------------

function getInstructorInfo(video: VideoResource): {
  name: string | null
} {
  const runs = video.runs
  if (!runs?.length) return { name: null }
  const instructors = runs[0]?.instructors
  if (!instructors?.length) return { name: null }
  const instructor = instructors[0]
  return {
    name: instructor.full_name || null,
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type VideoDetailPageProps = {
  videoId: number
  playlistId: number | null
}

const VideoDetailPage: React.FC<VideoDetailPageProps> = ({
  videoId,
  playlistId,
}) => {
  const { data: resource, isLoading: videoLoading } =
    useLearningResourcesDetail(videoId)

  const { data: playlistData, isLoading: playlistLoading } = useQuery({
    ...videoPlaylistQueries.detail(playlistId ?? 0),
    enabled: !!playlistId,
  })

  const { data: playlistItems, isLoading: itemsLoading } = useQuery({
    ...learningResourceQueries.items(playlistId ?? 0, {
      learning_resource_id: playlistId ?? 0,
    }),
    enabled: !!playlistId,
  })

  const playlist = playlistData as VideoPlaylistResource | undefined
  const video = resource as VideoResource | undefined

  const sources = video
    ? resolveVideoSources(video.video?.streaming_url, video.url)
    : []

  const { name: instructorName } = video
    ? getInstructorInfo(video)
    : { name: null }

  const duration = video?.video?.duration
    ? formatDurationClockTime(video.video.duration)
    : null

  const offeredBy = video?.offered_by?.name ?? null

  const otherVideos = (playlistItems ?? [])
    .filter(
      (item): item is VideoResource =>
        item.resource_type === VideoResourceResourceTypeEnum.Video &&
        item.id !== videoId,
    )
    .slice(0, 5)

  const totalPlaylistVideos = (playlistItems ?? []).filter(
    (item) => item.resource_type === VideoResourceResourceTypeEnum.Video,
  ).length

  const isLoading = videoLoading || (!!playlistId && playlistLoading)

  return (
    <PageWrapper>
      {/* Breadcrumb */}
      <BreadcrumbBar>
        <Container>
          <StyledBreadcrumbs
            variant="light"
            ancestors={[{ href: `/playlist/${playlistId}`, label: "Playlist" }]}
            current={video?.title}
          />
        </Container>
      </BreadcrumbBar>

      <ContentArea>
        <Container>
          {/* From [Playlist] link */}
          {playlist && (
            <MetaRow>
              <FromPlaylistLink href={`/playlist/${playlistId}`}>
                From {playlist.title}
              </FromPlaylistLink>
            </MetaRow>
          )}

          {/* Offered by badge */}
          {isLoading ? (
            <Skeleton width={140} height={18} style={{ marginBottom: 8 }} />
          ) : offeredBy ? (
            <OfferedByBadge>{offeredBy}</OfferedByBadge>
          ) : null}

          {/* Title */}
          {isLoading ? (
            <>
              <Skeleton
                variant="text"
                width="70%"
                height={48}
                style={{ marginBottom: 8 }}
              />
              <Skeleton
                variant="text"
                width="55%"
                height={48}
                style={{ marginBottom: 12 }}
              />
            </>
          ) : (
            <VideoTitle>{video?.title}</VideoTitle>
          )}

          {/* Description */}
          {isLoading ? (
            <>
              <Skeleton variant="text" width="90%" height={22} />
              <Skeleton
                variant="text"
                width="80%"
                height={22}
                style={{ marginBottom: 16 }}
              />
            </>
          ) : video?.description ? (
            <VideoDescription>{video.description}</VideoDescription>
          ) : null}

          {/* Author / instructor info */}
          {!isLoading && instructorName ? (
            <AuthorRow>
              <AuthorName>{instructorName}</AuthorName>
              {duration && <DurationChip>{duration}</DurationChip>}
            </AuthorRow>
          ) : !isLoading && duration ? (
            <AuthorRow>
              <DurationChip>{duration}</DurationChip>
            </AuthorRow>
          ) : null}

          {/* Video player */}
          <PlayerWrapper>
            {isLoading ? (
              <Skeleton variant="rectangular" width="100%" height="100%" />
            ) : sources.length > 0 ? (
              <VideoJsPlayer
                sources={sources}
                poster={
                  sources[0]?.type === "video/youtube"
                    ? undefined
                    : (video?.video?.cover_image_url ??
                      video?.image?.url ??
                      undefined)
                }
                autoplay={false}
                controls
                fluid={false}
              />
            ) : video?.image?.url ? (
              <ThumbnailWrapper>
                <Image
                  src={video.image.url}
                  alt={video.title ?? ""}
                  fill
                  sizes="100vw"
                  style={{ objectFit: "cover" }}
                />
              </ThumbnailWrapper>
            ) : (
              <NoVideoMessage>
                No playable source available for this video.
              </NoVideoMessage>
            )}
          </PlayerWrapper>

          {/* Topics */}
          {!isLoading && !!video?.topics?.length && (
            <TopicsSection>
              <TopicsLabel>Topics</TopicsLabel>
              <TopicChips>
                {video.topics.map((topic) => (
                  <TopicChip
                    key={topic.id}
                    href={`/search?topic=${encodeURIComponent(topic.name ?? "")}`}
                  >
                    {topic.name}
                  </TopicChip>
                ))}
              </TopicChips>
            </TopicsSection>
          )}

          {/* More from playlist */}
          {playlistId && (
            <>
              <Divider />
              {itemsLoading ? (
                <>
                  <Skeleton
                    variant="text"
                    width={220}
                    height={28}
                    style={{ marginBottom: 20 }}
                  />
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "16px 0",
                        borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
                      }}
                    >
                      <Skeleton variant="text" width="60%" height={20} />
                      <Skeleton variant="text" width="40%" height={16} />
                    </div>
                  ))}
                </>
              ) : otherVideos.length > 0 ? (
                <MoreFromSection>
                  <MoreFromTitle>
                    More from {playlist?.title ?? "this playlist"}
                  </MoreFromTitle>
                  <MoreFromList>
                    {otherVideos.map((item) => {
                      const itemDuration = item.video?.duration
                        ? formatDurationClockTime(item.video.duration)
                        : null
                      const { name: itemInstructor } = getInstructorInfo(item)
                      return (
                        <MoreFromItem
                          key={item.id}
                          href={`/playlist/detail/${item.id}?playlist=${playlistId}`}
                        >
                          <MoreFromItemLeft>
                            <MoreFromItemTitle className="more-from-title">
                              {item.title}
                            </MoreFromItemTitle>
                            {itemInstructor && (
                              <MoreFromItemMeta>
                                {itemInstructor}
                              </MoreFromItemMeta>
                            )}
                          </MoreFromItemLeft>
                          {itemDuration && (
                            <MoreFromItemDuration>
                              {itemDuration}
                            </MoreFromItemDuration>
                          )}
                        </MoreFromItem>
                      )
                    })}
                  </MoreFromList>
                  {totalPlaylistVideos > otherVideos.length + 1 && (
                    <SeeAllLink href={`/playlist/${playlistId}`}>
                      See all {totalPlaylistVideos} videos in{" "}
                      {playlist?.title ?? "this playlist"} →
                    </SeeAllLink>
                  )}
                </MoreFromSection>
              ) : null}
            </>
          )}
        </Container>
      </ContentArea>
    </PageWrapper>
  )
}

export default VideoDetailPage
