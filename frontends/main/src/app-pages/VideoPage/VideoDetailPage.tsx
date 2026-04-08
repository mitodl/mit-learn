"use client"

import React from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import Image from "next/image"
import { Typography, styled, theme, Skeleton, Breadcrumbs } from "ol-components"
import VideoContainer from "./VideoContainer"
import { RiShareForwardFill } from "@remixicon/react"
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

const BreadcrumbBar = styled.div(({ theme }) => ({
  padding: "32px 0 16px 0",
  borderBottom: `2px solid ${theme.custom.colors.red}`,
  [theme.breakpoints.down("sm")]: {
    padding: "16px 0 0 0",
  },
}))

const StyledBreadcrumbs = styled(Breadcrumbs)(() => ({
  "& > span > span": { paddingBottom: 0, paddingLeft: "4px" },
}))

const ContentArea = styled.div(({ theme }) => ({
  padding: "56px 0 80px",
  [theme.breakpoints.down("sm")]: {
    padding: "32px 0 80px",
  },
}))

const CategoryLabel = styled.span(({ theme }) => ({
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
}))

const VideoTitle = styled.h1(({ theme }) => ({
  ...theme.typography.h2,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.black,
  margin: "0 0 24px",
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
}))

const NoVideoMessage = styled.div({
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "rgba(255,255,255,0.5)",
  fontSize: 14,
})

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

function handleShare(title: string, url: string) {
  if (typeof navigator !== "undefined" && navigator.share) {
    navigator.share({ title, url }).catch(() => {})
  } else if (typeof navigator !== "undefined") {
    navigator.clipboard.writeText(url).catch(() => {})
  }
}

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

  const duration = video?.video?.duration
    ? formatDurationClockTime(video.video.duration)
    : null

  const topics = video?.topics ?? []

  const playlistLabel =
    playlist?.resource_category?.trim() || playlist?.title || "this playlist"

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

  return (
    <PageWrapper>
      {/* Breadcrumb bar */}
      <BreadcrumbBar>
        <VideoContainer>
          <StyledBreadcrumbs
            variant="light"
            style={{ margin: "0 4px" }}
            ancestors={[
              { href: "/", label: "Home" },
              { href: "/videos", label: "Videos" },
              ...(playlist
                ? [{ href: `/playlist/${playlistId}`, label: playlistLabel }]
                : []),
            ]}
            current={video?.title}
          />
        </VideoContainer>
      </BreadcrumbBar>

      <ContentArea>
        <VideoContainer>
          {/* Category label */}
          {isLoading ? (
            <Skeleton width={120} height={18} style={{ marginBottom: 8 }} />
          ) : playlist ? (
            <CategoryLabel>{playlistLabel}</CategoryLabel>
          ) : null}

          {/* Title */}
          {isLoading ? (
            <Skeleton
              variant="text"
              width="70%"
              height={52}
              style={{ marginBottom: 12 }}
            />
          ) : (
            <VideoTitle>The Roboticist Who Builds Trust</VideoTitle>
          )}

          {/* Meta: duration  topic1 · topic2 */}
          {!isLoading && (duration || topicNames) && (
            <MetaRow>
              <DurationText>{duration && <span>{duration}</span>}</DurationText>
              {/* <TopicText>{topicNames && <span>{topicNames}</span>}</TopicText> */}
              <TopicText>Robotics - AI - Human-Machine Interaction</TopicText>
            </MetaRow>
          )}

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
          <BorderLine />

          {/* Description */}
          {!isLoading && video?.description && (
            <DescriptionText>
              Most robotics labs optimize for speed or strength. Rus optimizes
              for trust. Her work on soft robots, self-assembling machines, and
              programmable matter starts from a different premise: that the
              hardest problem isn’t making a robot that works, it’s making one
              that people are willing to work alongside.
            </DescriptionText>
          )}

          {/* Share button */}
          {!isLoading && video && (
            <ShareRow>
              <ShareButton
                onClick={() =>
                  handleShare(video.title ?? "", window.location.href)
                }
              >
                <RiShareForwardFill size={16} />
                Share
              </ShareButton>
            </ShareRow>
          )}

          {/* More from playlist */}
          {playlistId && (
            <>
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
                    {otherVideos.splice(0, 3).map((item) => {
                      const itemDuration = item.video?.duration
                        ? formatDurationClockTime(item.video.duration)
                        : null
                      const imageUrl = item.image?.url ?? null
                      return (
                        <>
                          <MoreFromItem
                            key={item.id}
                            href={`/playlist/detail/${item.id}?playlist=${playlistId}`}
                          >
                            <MoreFromThumbnailWrapper>
                              {imageUrl && (
                                <Image
                                  src={imageUrl}
                                  alt={item.title}
                                  fill
                                  sizes="160px"
                                  style={{ objectFit: "cover" }}
                                />
                              )}
                              {itemDuration && (
                                <DurationBadge>{itemDuration}</DurationBadge>
                              )}
                            </MoreFromThumbnailWrapper>
                            <MoreFromTextSide>
                              <MoreFromItemTitle className="mf-title">
                                Decoding Climate from Ancient Ice
                              </MoreFromItemTitle>
                              {item.description && (
                                <MoreFromItemMeta>
                                  What 800,000-year-old ice cores reveal about
                                  the climate we're building now.
                                </MoreFromItemMeta>
                              )}
                            </MoreFromTextSide>
                          </MoreFromItem>
                          <SpacerBlock className="spacer-block"></SpacerBlock>
                        </>
                      )
                    })}
                  </MoreFromList>
                  {totalPlaylistVideos > otherVideos.length + 1 && (
                    <SeeAllLink href={`/playlist/${playlistId}`}>
                      View all in {playlistLabel} →
                    </SeeAllLink>
                  )}
                </>
              ) : null}
            </>
          )}
        </VideoContainer>
      </ContentArea>
    </PageWrapper>
  )
}

export default VideoDetailPage
