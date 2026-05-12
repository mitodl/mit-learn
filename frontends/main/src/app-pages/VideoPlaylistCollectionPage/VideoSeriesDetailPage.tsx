"use client"

import React, { useEffect, useRef } from "react"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { Skeleton, styled } from "ol-components"
import VideoContainer from "./VideoContainer"
import { useLearningResourcesDetail } from "api/hooks/learningResources"
import type { VideoResource, VideoPlaylistResource } from "api/v1"
import { formatDurationClockTime } from "ol-utilities"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { notFound } from "next/navigation"
import { useSeriesNavigation } from "./useSeriesNavigation"
import SeriesNavBar from "./SeriesNavBar"
import UpNextSection from "./UpNextSection"
import * as Styled from "./VideoSeriesDetailPage.styled"
import { buildVideoStructuredData } from "./videoStructuredData"
import VideoResourcePlayer from "./VideoResourcePlayer"

const StyledVideoResourcePlayer = styled(VideoResourcePlayer)(({ theme }) => ({
  borderBottom: `3px solid ${theme.custom.colors.darkGray2}`,
}))

type VideoSeriesDetailPageProps = {
  videoId: number
  playlistId: number | null
  playlistData?: VideoPlaylistResource
  playlistLoading: boolean
}

const VideoSeriesDetailPage: React.FC<VideoSeriesDetailPageProps> = ({
  videoId,
  playlistId,
  playlistData,
  playlistLoading,
}) => {
  const titleRef = useRef<HTMLHeadingElement>(null)

  const { data: resource, isLoading: videoLoading } =
    useLearningResourcesDetail(videoId)

  const showVideoPlaylistPage = useFeatureFlagEnabled(
    FeatureFlags.VideoPlaylistPage,
  )
  const flagsLoaded = useFeatureFlagsLoaded()

  const playlist = playlistData as VideoPlaylistResource | undefined
  const video = resource as VideoResource | undefined
  const {
    prevVideo,
    nextVideo,
    videoPosition,
    videoItems,
    currentIndex,
    itemsLoading,
    getVideoHref,
  } = useSeriesNavigation(videoId, playlistId)

  const duration = video?.video?.duration
    ? formatDurationClockTime(video.video.duration)
    : null

  const playlistLabel = playlist?.title || "Video Collection"

  const isLoading = videoLoading || (!!playlistId && playlistLoading)

  const videoTitleLabel = video?.title?.trim() || "Untitled video"
  const durationLabel = duration || "Unknown duration"

  const videoThumbnailAlt = `Video thumbnail for ${videoTitleLabel}. Duration: ${durationLabel}`
  const loadingStatusMessage = isLoading
    ? "Loading video details and player"
    : "Video details loaded"

  useEffect(() => {
    if (!isLoading) {
      titleRef.current?.focus()
    }
  }, [isLoading, videoId])

  // VideoObject JSON-LD for Google search indexing.
  // Rendered as a plain <script> tag so Googlebot can read it without executing
  // any additional JS. The replace guard prevents </script> injection.
  // See: https://developers.google.com/search/docs/appearance/structured-data/video
  const structuredData = !isLoading ? buildVideoStructuredData(video) : null

  if (!showVideoPlaylistPage) {
    return flagsLoaded ? notFound() : null
  }

  return (
    <Styled.PageWrapper>
      {structuredData && (
        <script
          type="application/ld+json"
          // JSON.stringify does not escape </ by default; replace prevents
          // a malicious title/description from breaking out of the script tag.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/<\//g, "<\\/"),
          }}
        />
      )}
      <Styled.SkipLinksNav aria-label="Skip links">
        <Styled.SkipLink href="#video-detail-main">
          Skip to main content
        </Styled.SkipLink>
        <Styled.SkipLink href="#video-player-region">
          Skip to video player
        </Styled.SkipLink>
      </Styled.SkipLinksNav>

      <Styled.ScreenReaderOnly
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {loadingStatusMessage}
      </Styled.ScreenReaderOnly>

      {/* Breadcrumbs */}
      <Styled.BreadcrumbBar>
        <VideoContainer>
          <Styled.StyledBreadcrumbs
            variant="light"
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
      </Styled.BreadcrumbBar>

      {/* Series navigation bar */}
      {playlistId && (
        <SeriesNavBar
          playlistId={playlistId}
          playlistLabel={playlistLabel}
          videoId={videoId}
          isLoading={isLoading}
          videoItems={videoItems}
          currentIndex={currentIndex}
          videoPosition={videoPosition}
          prevVideo={prevVideo}
          nextVideo={nextVideo}
          getVideoHref={getVideoHref}
        />
      )}

      <Styled.ContentArea id="video-detail-main" tabIndex={-1}>
        <VideoContainer>
          {/* Video title */}
          {isLoading ? (
            <Skeleton
              variant="text"
              width="70%"
              height={52}
              style={{ marginBottom: 12 }}
            />
          ) : (
            <Styled.VideoTitle ref={titleRef} tabIndex={-1}>
              {video?.title}
            </Styled.VideoTitle>
          )}
          {duration && (
            <Styled.StyledDuration>{duration}</Styled.StyledDuration>
          )}
          {/* Video player */}
          <StyledVideoResourcePlayer
            video={video}
            videoId={videoId}
            isLoading={isLoading}
            videoTitleLabel={videoTitleLabel}
            videoThumbnailAlt={videoThumbnailAlt}
          />

          {/* UP NEXT */}
          {!itemsLoading && nextVideo && (
            <UpNextSection nextVideo={nextVideo} getVideoHref={getVideoHref} />
          )}

          {/* Description */}
          {!isLoading && video?.description && (
            <Styled.DescriptionText
              id="video-description"
              style={nextVideo ? {} : { paddingTop: "40px" }}
              dangerouslySetInnerHTML={{ __html: video.description }}
            />
          )}

          {!isLoading && !video?.description && (
            <Styled.ScreenReaderOnly id="video-description">
              {videoTitleLabel}. Duration: {durationLabel}.
            </Styled.ScreenReaderOnly>
          )}
        </VideoContainer>
      </Styled.ContentArea>
    </Styled.PageWrapper>
  )
}

export default VideoSeriesDetailPage
