"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import Image from "next/image"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { Typography, styled, theme, Skeleton } from "ol-components"
import VideoContainer from "./VideoContainer"
import { RiShareForwardFill, RiPlayCircleFill } from "@remixicon/react"
import {
  SkipLinksNav,
  SkipLink,
  StyledBreadcrumbs,
  NoVideoMessage,
} from "./shared.styled"
import { useQuery } from "@tanstack/react-query"
import {
  useLearningResourcesDetail,
  learningResourceQueries,
} from "api/hooks/learningResources"
import type { VideoResource, VideoPlaylistResource } from "api/v1"
import { VideoResourceResourceTypeEnum } from "api/v1"
import { formatDurationClockTime } from "ol-utilities"
import { resolveVideoSources } from "./videoSources"
import type { VideoJsPlayerProps } from "./VideoJsPlayer"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { notFound } from "next/navigation"
import SharePopover from "@/components/SharePopover/SharePopover"

const NEXT_PUBLIC_ORIGIN = process.env.NEXT_PUBLIC_ORIGIN

// Lazy-load the video.js player only when the page mounts
const VideoJsPlayer = dynamic<VideoJsPlayerProps>(
  () => import("./VideoJsPlayer"),
  { ssr: false },
)

const PageWrapper = styled.div({
  backgroundColor: "#fff",
  minHeight: "100vh",
})

const BreadcrumbBar = styled.div(({ theme }) => ({
  padding: "20px 0 4px 0",
  borderBottom: `2px solid ${theme.custom.colors.red}`,
  [theme.breakpoints.down("sm")]: {
    padding: "16px 0 0 0",
  },
}))

const PlayIcon = styled(RiPlayCircleFill)({
  width: 36,
  height: 36,
})

const ContentArea = styled.div(({ theme }) => ({
  padding: "56px 0 80px",
  [theme.breakpoints.down("sm")]: {
    padding: "32px 0 80px",
  },
}))

const CategoryLabel = styled(Link)(({ theme }) => ({
  display: "block",
  ...theme.typography.body3,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.red,
  textTransform: "uppercase",
  letterSpacing: "1.92px",
  marginBottom: "8px",
  fontSize: "12px",
  fontStyle: "normal",
  lineHeight: "150%" /* 18px */,
  "&:hover": {
    textDecoration: "underline",
  },
}))

const VideoTitle = styled.h1(({ theme }) => ({
  ...theme.typography.h2,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.black,
  margin: "0 0 24px",
  "&:focus": { outline: "none" },
  fontSize: "44px",
  fontStyle: "normal",
  lineHeight: "120%" /* 52.8px */,
  letterSpacing: "-0.88px",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h3,
    margin: "0 0 14px",
    letterSpacing: "inherit",
  },
}))

const MetaRow = styled.div({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray1,
  marginBottom: "24px",
  [theme.breakpoints.down("sm")]: {
    marginBottom: "16px",
  },
})

const PlayerWrapper = styled.div(({ theme }) => ({
  width: "100%",
  aspectRatio: "16/9",
  backgroundColor: "#000",
  overflow: "hidden",
  position: "relative",
  marginTop: "-10px",
  [theme.breakpoints.down("sm")]: {
    marginTop: "0",
  },
  ".video-js, .vjs-tech": {
    width: "100% !important",
    height: "100% !important",
    position: "absolute",
    top: 0,
    left: 0,
  },
  ".vjs-big-play-button": {
    width: "64px !important",
    height: "64px !important",
    lineHeight: "64px !important",
    borderRadius: "50% !important",
  },
}))

const DescriptionText = styled(Typography)(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.darkGray2,
  marginBottom: "22px",
  fontSize: "18px",
  fontWeight: theme.typography.fontWeightMedium,
  lineHeight: "30px",
  [theme.breakpoints.down("sm")]: {
    fontSize: "16px",
    lineHeight: "28px",
    marginBottom: "24px",
  },
}))

const ShareRow = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "flex-end",
  width: "100%",
  [theme.breakpoints.down("sm")]: {
    marginBottom: "32px",
  },
}))

const ShareButton = styled.button(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  borderRadius: "4px",
  padding: "14px 12px",
  height: "32px",
  border: `1px solid ${theme.custom.colors.silverGrayLight}`,
  background: `${theme.custom.colors.white}`,
  cursor: "pointer",
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray1,
  fontWeight: theme.typography.fontWeightMedium,
  "&:hover": {
    color: theme.custom.colors.red,
  },
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    justifyContent: "center",
  },
}))

const MoreFromTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.body3,
  fontWeight: theme.typography.fontWeightBold,
  textTransform: "uppercase",
  color: theme.custom.colors.black,
  padding: "32px 0",
  lineHeight: "150%",
  letterSpacing: "1.92px",
  [theme.breakpoints.down("sm")]: {
    padding: "24px 0",
  },
}))

const MoreFromList = styled.div({
  display: "flex",
  flexDirection: "column",
})

const BorderLine = styled.div(({ theme }) => ({
  borderBottom: `4px solid ${theme.custom.colors.darkGray2}`,
  marginBottom: "40px",
  [theme.breakpoints.down("sm")]: {
    marginBottom: "24px",
  },
}))

const MoreFromItem = styled(Link)({
  display: "flex",
  alignItems: "flex-start",
  gap: "24px",
  padding: "24px 0",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  textDecoration: "none",
  "&:hover .mf-title": { color: theme.custom.colors.red },

  "&:hover .video-card-title, &:focus-visible .video-card-title": {
    color: theme.custom.colors.red,
  },

  "&:hover .play-overlay": {
    opacity: 0.5,
  },

  "&:focus-visible .play-overlay": {
    opacity: 0.5,
  },

  "&:first-child": {
    padding: "0 0 24px 0",
  },

  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
  },
})

const MoreFromThumbnailWrapper = styled.div(({ theme }) => ({
  position: "relative",
  flexShrink: 0,
  width: 160,
  aspectRatio: "16/9",
  backgroundColor: theme.custom.colors.black,
  overflow: "hidden",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}))

const DurationBadge = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  position: "absolute",
  bottom: 0,
  right: 0,
  backgroundColor: theme.custom.colors.darkGray2,
  color: "#fff",
  fontWeight: theme.typography.fontWeightMedium,
  padding: "4px 6px",
  zIndex: 1,
}))

const MoreFromTextSide = styled.div(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  paddingTop: "17px",
  [theme.breakpoints.down("sm")]: {
    paddingTop: 0,
  },
}))

const MoreFromItemTitle = styled(Typography)({
  ...theme.typography.subtitle2,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.black,
  transition: "color 0.15s",
  marginBottom: "4px",
  fontSize: "20px",
  lineHeight: "26px" /* 130% */,
})

const MoreFromItemMeta = styled(Typography)({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
  overflow: "hidden",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  lineHeight: "22px",
})

const SeeAllLink = styled(Link)(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  marginTop: "40px",
  ...theme.typography.body1,
  color: theme.custom.colors.red,
  fontWeight: theme.typography.fontWeightMedium,
  lineHeight: "150%",
  textDecoration: "none",
  "&:hover": { textDecoration: "underline" },
  [theme.breakpoints.down("sm")]: {
    marginTop: "28px",
  },
}))

const ThumbnailWrapper = styled.div({
  position: "relative",
  width: "100%",
  height: "100%",
})

const SpacerBlock = styled.div(({ theme }) => ({
  "& .spacer-block": {
    display: "none",
  },
  [theme.breakpoints.down("sm")]: {
    height: "8px",
    "& .spacer-block": {
      display: "block",
    },
  },
}))

const TopicText = styled.span(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  ...theme.typography.body2,
  lineHeight: "22px",
  paddingLeft: "8px",
}))

const DurationText = styled.span(({ theme }) => ({
  color: theme.custom.colors.black,
  ...theme.typography.body2,
  lineHeight: "22px",
  fontWeight: theme.typography.fontWeightBold,
}))

const PlayOverlay = styled.div({
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  opacity: 0,
  transition: "opacity 0.2s",
  backgroundColor: "rgba(0, 0, 0, 0.18)",
})

const ScreenReaderOnly = styled.span({
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
})

type VideoDetailPageProps = {
  videoId: number
  playlistId: number | null
  playlistData?: VideoPlaylistResource
  playlistLoading: boolean
}

const VideoDetailPage: React.FC<VideoDetailPageProps> = ({
  videoId,
  playlistId,
  playlistData,
  playlistLoading,
}) => {
  const [shareOpen, setShareOpen] = useState(false)
  const shareButtonRef = useRef<HTMLButtonElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)

  const { data: resource, isLoading: videoLoading } =
    useLearningResourcesDetail(videoId)

  const { data: playlistItems, isLoading: itemsLoading } = useQuery({
    ...learningResourceQueries.items(playlistId ?? 0, {
      learning_resource_id: playlistId ?? 0,
    }),
    enabled: !!playlistId,
  })

  const showVideoPlaylistPage = useFeatureFlagEnabled(
    FeatureFlags.VideoPlaylistPage,
  )
  const flagsLoaded = useFeatureFlagsLoaded()

  const playlist = playlistData as VideoPlaylistResource | undefined
  const video = resource as VideoResource | undefined

  const sources = useMemo(
    () =>
      video
        ? resolveVideoSources(
            video.video?.streaming_url,
            video.url,
            video.content_files?.[0]?.youtube_id,
          )
        : [],
    [video],
  )

  const duration = video?.video?.duration
    ? formatDurationClockTime(video.video.duration)
    : null

  const topics = video?.topics ?? []

  const playlistLabel = playlist?.title || "Video Collection"

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

  const topicNames = topics
    .map((t) => t.name)
    .filter(Boolean)
    .join(" · ")

  const videoTitleLabel = video?.title?.trim() || "Untitled video"
  const durationLabel = duration || "Unknown duration"
  const topicNamesLabel = topicNames || "No topics listed"
  const videoThumbnailAlt = `Video thumbnail for ${videoTitleLabel}. Duration: ${durationLabel}. Topics: ${topicNamesLabel}`
  const loadingStatusMessage = isLoading
    ? "Loading video details and player"
    : "Video details loaded"

  useEffect(() => {
    if (!isLoading) {
      titleRef.current?.focus()
    }
  }, [isLoading, videoId])

  if (!showVideoPlaylistPage) {
    return flagsLoaded ? notFound() : null
  }

  return (
    <PageWrapper>
      <SkipLinksNav aria-label="Skip links">
        <SkipLink href="#video-detail-main">Skip to main content</SkipLink>
        <SkipLink href="#video-player-region">Skip to video player</SkipLink>
        {playlistId && (
          <SkipLink href="#more-from-playlist">Skip to more videos</SkipLink>
        )}
      </SkipLinksNav>

      <ScreenReaderOnly role="status" aria-live="polite" aria-atomic="true">
        {loadingStatusMessage}
      </ScreenReaderOnly>

      <BreadcrumbBar>
        <VideoContainer>
          <StyledBreadcrumbs
            variant="light"
            separatorStyle={{ margin: "0 4px" }}
            ancestors={[
              { href: "/", label: "Home" },
              ...(playlist
                ? [
                    {
                      href: `/video-playlist/${playlistId}`,
                      label: playlistLabel,
                    },
                  ]
                : []),
            ]}
            current={video?.title}
          />
        </VideoContainer>
      </BreadcrumbBar>

      <ContentArea id="video-detail-main" tabIndex={-1}>
        <VideoContainer>
          {isLoading ? (
            <Skeleton width={120} height={18} style={{ marginBottom: 8 }} />
          ) : playlist ? (
            <CategoryLabel href={`/video-playlist/${playlistId}`}>
              {playlistLabel}
            </CategoryLabel>
          ) : null}

          {isLoading ? (
            <Skeleton
              variant="text"
              width="70%"
              height={52}
              style={{ marginBottom: 12 }}
            />
          ) : (
            <VideoTitle ref={titleRef} tabIndex={-1}>
              {video?.title}
            </VideoTitle>
          )}

          {!isLoading && (duration || topicNames) && (
            <MetaRow>
              <DurationText>{duration && <span>{duration}</span>}</DurationText>
              <TopicText>{topicNames}</TopicText>
            </MetaRow>
          )}

          <PlayerWrapper
            id="video-player-region"
            tabIndex={-1}
            role="region"
            aria-label={`Video player for ${videoTitleLabel}`}
            aria-describedby="video-description"
          >
            {isLoading ? (
              <div
                role="status"
                aria-live="polite"
                aria-label="Loading video player"
              >
                <Skeleton variant="rectangular" width="100%" height="100%" />
              </div>
            ) : sources.length > 0 ? (
              <VideoJsPlayer
                key={videoId}
                sources={sources}
                poster={
                  sources[0]?.type === "video/youtube"
                    ? undefined
                    : (video?.video?.cover_image_url ??
                      video?.content_files?.[0]?.image_src ??
                      video?.image?.url ??
                      undefined)
                }
                autoplay={false}
                controls
                fluid={false}
                ariaLabel={`Video: ${videoTitleLabel}`}
                ariaDescribedBy="video-description"
              />
            ) : video?.image?.url || video?.content_files?.[0]?.image_src ? (
              <ThumbnailWrapper>
                <Image
                  src={
                    (video?.image?.url ?? video?.content_files?.[0]?.image_src)!
                  }
                  alt={videoThumbnailAlt}
                  fill
                  sizes="100vw"
                  style={{ objectFit: "cover" }}
                />
              </ThumbnailWrapper>
            ) : (
              <>
                <ScreenReaderOnly role="alert" aria-live="polite">
                  No playable source available for this video.
                </ScreenReaderOnly>
                <NoVideoMessage>
                  No playable source available for this video.
                </NoVideoMessage>
              </>
            )}
          </PlayerWrapper>
          <BorderLine />

          {!isLoading && video?.description && (
            <DescriptionText
              id="video-description"
              dangerouslySetInnerHTML={{ __html: video.description }}
            />
          )}

          {!isLoading && !video?.description && (
            <ScreenReaderOnly id="video-description">
              {videoTitleLabel}. Duration: {durationLabel}. Topics:{" "}
              {topicNamesLabel}.
            </ScreenReaderOnly>
          )}

          {!isLoading && video && (
            <ShareRow>
              <ShareButton
                ref={shareButtonRef}
                aria-label={`Share ${video.title ?? "video"}`}
                onClick={() => setShareOpen(true)}
              >
                <RiShareForwardFill size={16} />
                Share
              </ShareButton>
              <SharePopover
                open={shareOpen}
                title={video?.title ?? ""}
                anchorEl={
                  shareButtonRef.current as unknown as HTMLDivElement | null
                }
                onClose={() => setShareOpen(false)}
                pageUrl={`${NEXT_PUBLIC_ORIGIN}/video-playlist/${video?.id}?playlist=${playlistId}`}
              />
            </ShareRow>
          )}

          {/* More from playlist */}
          {playlistId && (
            <section id="more-from-playlist" tabIndex={-1}>
              {itemsLoading ? (
                <>
                  <Skeleton
                    variant="text"
                    width={220}
                    height={24}
                    style={{ marginBottom: 8 }}
                  />
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: 16,
                        padding: "16px 0",
                        borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
                      }}
                    >
                      <Skeleton variant="rectangular" width={160} height={90} />
                      <div style={{ flex: 1 }}>
                        <Skeleton variant="text" width="70%" height={20} />
                        <Skeleton variant="text" width="50%" height={16} />
                      </div>
                    </div>
                  ))}
                </>
              ) : otherVideos.length > 0 ? (
                <>
                  <MoreFromTitle>More from {playlistLabel}</MoreFromTitle>
                  <MoreFromList>
                    {otherVideos.map((item) => {
                      const itemDuration = item.video?.duration
                        ? formatDurationClockTime(item.video.duration)
                        : null
                      const imageUrl =
                        item.image?.url ??
                        item.content_files?.[0]?.image_src ??
                        null
                      const itemTopicNames = (item.topics ?? [])
                        .map((topic) => topic.name)
                        .filter(Boolean)
                        .join(" · ")
                      return (
                        <React.Fragment key={item.id}>
                          <MoreFromItem
                            href={`/video-playlist/detail/${item.id}?playlist=${playlistId}`}
                            aria-label={`Open video ${item.title}`}
                          >
                            <MoreFromThumbnailWrapper>
                              {imageUrl && (
                                <Image
                                  src={imageUrl}
                                  alt={`Video thumbnail for ${item.title}. Duration: ${itemDuration || "Unknown duration"}. Topics: ${itemTopicNames || "No topics listed"}`}
                                  fill
                                  sizes="160px"
                                  style={{ objectFit: "cover" }}
                                />
                              )}
                              {itemDuration && (
                                <DurationBadge>{itemDuration}</DurationBadge>
                              )}
                              <PlayOverlay className="play-overlay">
                                <PlayIcon />
                              </PlayOverlay>
                            </MoreFromThumbnailWrapper>
                            <MoreFromTextSide>
                              <MoreFromItemTitle className="mf-title">
                                {item.title}
                              </MoreFromItemTitle>
                              {item.description && (
                                <MoreFromItemMeta
                                  dangerouslySetInnerHTML={{
                                    __html: item.description,
                                  }}
                                />
                              )}
                            </MoreFromTextSide>
                          </MoreFromItem>
                          <SpacerBlock className="spacer-block"></SpacerBlock>
                        </React.Fragment>
                      )
                    })}
                  </MoreFromList>
                  {totalPlaylistVideos > otherVideos.length + 1 && (
                    <SeeAllLink
                      href={`/video-playlist/${playlistId}`}
                      aria-label={`View all videos in ${playlistLabel}`}
                    >
                      View all in {playlistLabel} →
                    </SeeAllLink>
                  )}
                </>
              ) : null}
            </section>
          )}
        </VideoContainer>
      </ContentArea>
    </PageWrapper>
  )
}

export default VideoDetailPage
