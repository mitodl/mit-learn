"use client"

import React, { useEffect, useMemo, useRef } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import Image from "next/image"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { Typography, styled, Skeleton, Breadcrumbs, theme } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import VideoContainer from "./VideoContainer"
import { RiArrowLeftLine, RiArrowRightLine, RiPlayFill } from "@remixicon/react"
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

const VideoJsPlayer = dynamic<VideoJsPlayerProps>(
  () => import("./VideoJsPlayer"),
  { ssr: false },
)

const PageWrapper = styled.div({
  backgroundColor: theme.custom.colors.lightGray1,
  minHeight: "100vh",
})

const SkipLinksNav = styled.nav({
  position: "absolute",
  top: 0,
  left: 0,
  zIndex: 1000,
})

const SkipLink = styled.a(({ theme }) => ({
  position: "absolute",
  left: "-9999px",
  top: "auto",
  width: 1,
  height: 1,
  overflow: "hidden",
  backgroundColor: theme.custom.colors.white,
  color: theme.custom.colors.black,
  padding: "8px 12px",
  border: `2px solid ${theme.custom.colors.red}`,
  textDecoration: "none",
  "&:focus": {
    left: "16px",
    top: "16px",
    width: "auto",
    height: "auto",
  },
}))

const BreadcrumbBar = styled.div(({ theme }) => ({
  padding: "20px 0 4px 0",
  borderBottom: `2px solid ${theme.custom.colors.red}`,
  [theme.breakpoints.down("sm")]: {
    padding: "16px 0 0 0",
  },
}))

const StyledBreadcrumbs = styled(Breadcrumbs)(() => ({
  "& > span > span": { paddingBottom: 0, paddingLeft: "4px" },
}))

// ── Series navigation bar (shown below breadcrumbs when part of a playlist) ──

const SeriesNavBar = styled.div(({ theme }) => ({
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
}))

const SeriesNavTopRow = styled(VideoContainer)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "56px 0 12px !important",
  gap: "16px",
  [theme.breakpoints.down("lg")]: {
    padding: "32px 16px 12px !important",
  },
}))

const SeriesNavTitle = styled(Link)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.darkRed,
  fontWeight: theme.typography.fontWeightMedium,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  textDecoration: "none",
  flexShrink: 1,
  minWidth: 0,
  "&:hover": { color: theme.custom.colors.red },
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body3,
    fontWeight: theme.typography.fontWeightMedium,
  },
}))

const VideoPositionLabel = styled(Typography)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
  whiteSpace: "nowrap",
  flexShrink: 0,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body3,
    fontWeight: theme.typography.fontWeightMedium,
  },
}))

const ProgressBarRow = styled(VideoContainer)(({ theme }) => ({
  display: "flex",
  gap: "3px",
  padding: "0 0 0 0 !important",
  [theme.breakpoints.down("lg")]: {
    padding: "0 16px !important",
  },
}))

const ProgressSegment = styled.div<{ $active: boolean; $done: boolean }>(
  ({ theme, $active, $done }) => ({
    flex: 1,
    height: "4px",
    borderRadius: "2px",
    backgroundColor: $active
      ? theme.custom.colors.darkGray1
      : $done
        ? theme.custom.colors.darkRed
        : theme.custom.colors.lightGray2,
  }),
)

const SeriesNavBottomRow = styled(VideoContainer)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 0 16px !important",
  [theme.breakpoints.down("lg")]: {
    padding: "16px 16px 16px !important",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "16px",
  },
}))

const NavLink = styled(Link)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "6px",
  ...theme.typography.body3,
  color: theme.custom.colors.darkRed,
  textDecoration: "none",
  maxWidth: "45%",
  minWidth: 0,
  flexShrink: 1,
  "&:hover": { color: theme.custom.colors.red },
  [theme.breakpoints.down("sm")]: {
    maxWidth: "100%",
  },
}))

const StyledButtonLink = styled(ButtonLink)(({ theme }) => ({
  marginTop: "8px",
  [theme.breakpoints.down("sm")]: {
    marginLeft: "24px",
    marginTop: "0",
  },
}))

const NavLinkText = styled.span({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minWidth: 0,
})

const NavArrowIcon = styled.span({
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
})

const ContentArea = styled.div(({ theme }) => ({
  padding: "40px 0 80px",
  [theme.breakpoints.down("sm")]: {
    padding: "32px 0 80px",
  },
}))

const InstitutionLabel = styled.span(({ theme }) => ({
  display: "block",
  ...theme.typography.body2,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.silverGrayDark,
  textTransform: "uppercase",
  marginBottom: "16px",
  lineHeight: "26px",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body3,
    lineHeight: "22px",
    marginBottom: "8px",
  },
}))

const VideoTitle = styled.h1(({ theme }) => ({
  ...theme.typography.h2,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.black,
  margin: "0 0 40px",
  "&:focus": { outline: "none" },
  fontSize: "44px",
  fontStyle: "normal",
  lineHeight: "120%",
  letterSpacing: "-0.88px",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h3,
    margin: "0 0 14px",
    letterSpacing: "inherit",
  },
}))

const PlayerWrapper = styled.div(({ theme }) => ({
  width: "100%",
  aspectRatio: "16/9",
  backgroundColor: "#000",
  overflow: "hidden",
  position: "relative",
  borderBottom: `3px solid ${theme.custom.colors.darkGray2}`,
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
    width: "92px !important",
    height: "92px !important",
    lineHeight: "92px !important",
    borderRadius: "50% !important",
    backgroundColor: "#d8daddb3 !important",
    border: "none !important",
    fontSize: "4em !important",
    marginTop: "-1.25em !important",
    marginLeft: "-1.18em !important",
    [theme.breakpoints.down("sm")]: {
      width: "68px !important",
      height: "68px !important",
      lineHeight: "68px !important",
      marginLeft: "-1em !important",
      marginTop: "-.7em !important",
    },
  },

  "vjs-icon-placeholder": {
    border: "none !important",
  },

  "& .vjs-big-play-button": {
    opacity: 1,
    transform: "scale(1)",
    transition: "opacity 0.3s ease, transform 0.3s ease",
  },
  "&:hover .vjs-big-play-button": {
    opacity: 0.75,
    transform: "scale(1.12)",
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

// ── UP NEXT section ──

const UpNextSection = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  padding: "16px 32px",
  marginBottom: "32px",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "12px",
    padding: "16px 0",
  },
}))

const UpNextLeft = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  minWidth: 0,
  [theme.breakpoints.down("sm")]: {
    paddingLeft: "24px",
  },
}))

const UpNextLabel = styled(Typography)(({ theme }) => ({
  ...theme.typography.body1,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.silverGrayDark,
  textTransform: "uppercase",
  lineHeight: "150%",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body2,
    lineHeight: "22px",
  },
}))

const UpNextTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.body1,
  fontWeight: theme.typography.fontWeightMedium,
  color: theme.custom.colors.darkGray2,
  lineHeight: "24px",
  overflow: "hidden",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
}))

const MetaRow = styled.div(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray1,
  marginBottom: "40px",
  lineHeight: "1.8",
  [theme.breakpoints.down("sm")]: {
    marginBottom: "32px",
  },
}))

const HideOnMobile = styled.div(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}))

const HideOnDesktop = styled.div(({ theme }) => ({
  display: "none",
  [theme.breakpoints.down("sm")]: {
    display: "block",
  },
}))

const MetaInstructorLine = styled.div(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.darkGray2,
}))

const StyledDuration = styled.div(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
  [theme.breakpoints.down("sm")]: {
    marginTop: "4px",
  },
}))

const DescriptionText = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
  marginBottom: "16px",
  lineHeight: "22px",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body2,
    lineHeight: "22px",
    marginBottom: "24px",
  },
}))

const SectionDivider = styled.div(({ theme }) => ({
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
  margin: "32px 0",
}))

// ── VIDEO SERIES section (topic chips) ──

const VideoSeriesSectionHeading = styled(Typography)(({ theme }) => ({
  ...theme.typography.body3,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.black,
  textTransform: "uppercase",
  letterSpacing: "1.92px",
  marginBottom: "16px",
}))

const TopicChipsRow = styled.div({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
})

const TopicChip = styled(Link)(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 16px",
  border: `1px solid ${theme.custom.colors.silverGrayLight}`,
  color: theme.custom.colors.darkRed,
  textDecoration: "none",
  ...theme.typography.body3,
  lineHeight: "12px",
  fontWeight: theme.typography.fontWeightMedium,
  "&:hover": {
    backgroundColor: theme.custom.colors.silverGrayLight,
    color: theme.custom.colors.red,
  },
}))

const ThumbnailWrapper = styled.div({
  position: "relative",
  width: "100%",
  height: "100%",
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
      video ? resolveVideoSources(video.video?.streaming_url, video.url) : [],
    [video],
  )

  const duration = video?.video?.duration
    ? formatDurationClockTime(video.video.duration)
    : null

  const topics = video?.topics ?? []
  const playlistLabel = "Introduction to Deep Learning" //playlist?.title || "Video Collection"

  // Series navigation: find current video position and prev/next
  const videoItems = useMemo(
    () =>
      (playlistItems ?? []).filter(
        (item): item is VideoResource =>
          item.resource_type === VideoResourceResourceTypeEnum.Video,
      ),
    [playlistItems],
  )
  const currentIndex = videoItems.findIndex((item) => item.id === videoId)
  const prevVideo = currentIndex > 0 ? videoItems[currentIndex - 1] : null
  const nextVideo =
    currentIndex >= 0 && currentIndex < videoItems.length - 1
      ? videoItems[currentIndex + 1]
      : null
  const videoPosition = currentIndex >= 0 ? currentIndex + 1 : null

  // Meta: instructors, department, duration, term
  const run = video?.runs?.[0]
  const instructorNames =
    run?.instructors
      ?.map((i) => i.full_name)
      .filter(Boolean)
      .join(", ") ?? null
  const departmentName = video?.departments?.[0]?.name ?? null
  const term =
    run?.semester && run?.year
      ? `${run.semester} ${run.year}`
      : run?.semester || (run?.year ? String(run.year) : null)
  const metaParts = [instructorNames, departmentName, duration, term].filter(
    Boolean,
  )

  const institutionLabel =
    video?.departments?.[0]?.name?.toUpperCase() ??
    playlist?.offered_by?.name?.toUpperCase() ??
    null

  const isLoading = videoLoading || (!!playlistId && playlistLoading)

  const videoTitleLabel = video?.title?.trim() || "Untitled video"
  const durationLabel = duration || "Unknown duration"
  const topicNamesLabel =
    topics
      .map((t) => t.name)
      .filter(Boolean)
      .join(" · ") || "No topics listed"
  const videoThumbnailAlt = `Video thumbnail for ${videoTitleLabel}. Duration: ${durationLabel}. Topics: ${topicNamesLabel}`
  const loadingStatusMessage = isLoading
    ? "Loading video details and player"
    : "Video details loaded"

  const getVideoHref = (v: VideoResource) =>
    `/video-playlist/detail/${v.id}?playlist=${playlistId}`

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
      </SkipLinksNav>

      <ScreenReaderOnly role="status" aria-live="polite" aria-atomic="true">
        {loadingStatusMessage}
      </ScreenReaderOnly>

      {/* Breadcrumbs */}
      <BreadcrumbBar>
        <VideoContainer>
          <StyledBreadcrumbs
            variant="light"
            separatorStyle={{ margin: "0 4px" }}
            ancestors={[
              { href: "/", label: "Home" },
              ...(playlist && playlistId
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

      {/* Series navigation bar */}
      {playlistId && (
        <SeriesNavBar>
          {/* Top row: series title + video position */}
          <SeriesNavTopRow>
            <SeriesNavTitle href={`/video-playlist/${playlistId}`}>
              {isLoading ? <Skeleton width={200} height={20} /> : playlistLabel}
            </SeriesNavTitle>
            {!isLoading && videoPosition !== null && videoItems.length > 0 && (
              <VideoPositionLabel>
                Video {videoPosition} of {videoItems.length}
              </VideoPositionLabel>
            )}
          </SeriesNavTopRow>

          {/* Segmented progress bar */}
          {!isLoading && videoItems.length > 0 && (
            <ProgressBarRow>
              {videoItems.map((item, i) => (
                <ProgressSegment
                  key={item.id}
                  $active={item.id === videoId}
                  $done={currentIndex >= 0 && i < currentIndex}
                />
              ))}
            </ProgressBarRow>
          )}

          {/* Bottom row: prev / next text links */}
          <SeriesNavBottomRow>
            {prevVideo ? (
              <NavLink href={getVideoHref(prevVideo)}>
                <NavArrowIcon>
                  <RiArrowLeftLine size={16} />
                </NavArrowIcon>
                {/* <NavLinkText>Previous: {prevVideo.title}</NavLinkText> */}
                <NavLinkText>
                  Previous: Neural Networks and Backpropagation
                </NavLinkText>
              </NavLink>
            ) : (
              <span />
            )}
            {nextVideo && (
              <NavLink
                href={getVideoHref(nextVideo)}
                style={{ justifyContent: "flex-end" }}
              >
                {/* <NavLinkText>Next: {nextVideo.title}</NavLinkText> */}
                <NavLinkText>
                  Next: Recurrent Neural Networks and Attention
                </NavLinkText>
                <NavArrowIcon>
                  <RiArrowRightLine size={16} />
                </NavArrowIcon>
              </NavLink>
            )}
          </SeriesNavBottomRow>
        </SeriesNavBar>
      )}

      <ContentArea id="video-detail-main" tabIndex={-1}>
        <VideoContainer>
          {/* Institution / category label */}
          {isLoading ? (
            <Skeleton width={280} height={16} style={{ marginBottom: 8 }} />
          ) : institutionLabel ? (
            // <InstitutionLabel>{institutionLabel}</InstitutionLabel>
            <InstitutionLabel>
              MIT Computer Science and Artificial Intelligence Laboratory
            </InstitutionLabel>
          ) : null}

          {/* Video title */}
          {isLoading ? (
            <Skeleton
              variant="text"
              width="70%"
              height={52}
              style={{ marginBottom: 12 }}
            />
          ) : (
            <VideoTitle ref={titleRef} tabIndex={-1}>
              {/* {video?.title} */}
              Convolutional Neural Networks
            </VideoTitle>
          )}

          {/* Video player */}
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
                      video?.image?.url ??
                      undefined)
                }
                autoplay={false}
                controls
                fluid={false}
                ariaLabel={`Video: ${videoTitleLabel}`}
                ariaDescribedBy="video-description"
              />
            ) : video?.image?.url ? (
              <ThumbnailWrapper>
                <Image
                  src={video.image.url}
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

          {/* UP NEXT */}
          {!itemsLoading && nextVideo && (
            <UpNextSection>
              <UpNextLeft>
                <UpNextLabel>Up Next</UpNextLabel>
                {/* <UpNextTitle>{nextVideo.title}</UpNextTitle> */}
                <UpNextTitle>
                  Recurrent Neural Networks and Attention
                </UpNextTitle>
              </UpNextLeft>
              <StyledButtonLink
                href={getVideoHref(nextVideo)}
                variant="primary"
                startIcon={<RiPlayFill size={16} />}
              >
                Continue
              </StyledButtonLink>
            </UpNextSection>
          )}

          {!isLoading && metaParts.length > 0 && (
            <HideOnMobile>
              <MetaRow>{metaParts.join(" · ")}</MetaRow>
            </HideOnMobile>
          )}
          {!isLoading &&
            (instructorNames || departmentName || duration || term) && (
              <HideOnDesktop>
                <MetaRow>
                  {instructorNames && (
                    <MetaInstructorLine>{instructorNames}</MetaInstructorLine>
                  )}
                  {departmentName && <div>{departmentName}</div>}
                  {(duration || term) && (
                    <StyledDuration>
                      {[duration, term].filter(Boolean).join(" · ")}
                    </StyledDuration>
                  )}
                </MetaRow>
              </HideOnDesktop>
            )}

          {/* Description */}
          {!isLoading && video?.description && (
            <DescriptionText id="video-description">
              {/* {video.description} */}
              Image recognition, feature hierarchies, and the architectures that
              transformed computer vision. This lecture covers the mathematical
              foundations of convolution operations, pooling strategies, and how
              deep convolutional networks learn hierarchical representations
              from raw pixel data.
            </DescriptionText>
          )}

          {!isLoading && !video?.description && (
            <ScreenReaderOnly id="video-description">
              {videoTitleLabel}. Duration: {durationLabel}. Topics:{" "}
              {topicNamesLabel}.
            </ScreenReaderOnly>
          )}

          {/* VIDEO SERIES topic chips */}
          {!isLoading && topics.length > 0 && (
            <>
              <SectionDivider />
              <VideoSeriesSectionHeading>
                Video Series
              </VideoSeriesSectionHeading>
              <TopicChipsRow>
                {topics.map((topic) => (
                  <TopicChip
                    key={topic.id}
                    href={`/search?topic=${encodeURIComponent(topic.name ?? "")}`}
                  >
                    {topic.name}
                  </TopicChip>
                ))}
              </TopicChipsRow>
            </>
          )}
        </VideoContainer>
      </ContentArea>
    </PageWrapper>
  )
}

export default VideoDetailPage
