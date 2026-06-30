"use client"

import React, { useEffect, useRef } from "react"
import { Skeleton, styled } from "ol-components"
import VideoContainer from "./VideoContainer"
import { useLearningResourcesDetail } from "api/hooks/learningResources"
import type { VideoResource, VideoPlaylistResource } from "api/v1"
import { formatDurationClockTime } from "ol-utilities"
import { useSeriesNavigation } from "./useSeriesNavigation"
import { videoDetailPageView, videoPlaylistPageView } from "@/common/urls"
import SeriesNavBar from "./SeriesNavBar"
import UpNextSection from "./UpNextSection"
import * as Styled from "./VideoSeriesDetailPage.styled"
import { env } from "@/env"
import { buildVideoStructuredData } from "./videoStructuredData"
import VideoResourcePlayer from "./VideoResourcePlayer"
import type { VideoPlayerHandle } from "./VideoResourcePlayer"

import VideoShareButton from "./VideoShareButton"

const NEXT_PUBLIC_ORIGIN = env("NEXT_PUBLIC_ORIGIN")

const StyledVideoResourcePlayer = styled(VideoResourcePlayer)(({ theme }) => ({
  borderBottom: `3px solid ${theme.custom.colors.darkGray2}`,
}))

const StyledVideoShareButton = styled(VideoShareButton)({
  height: "40px",
  marginTop: "8px",
  padding: "18px 16px",
  margin: "0 0 24px",
})

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
  const playerRef = useRef<VideoPlayerHandle | null>(null)

  const { data: resource, isLoading: videoLoading } =
    useLearningResourcesDetail(videoId)

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
                      href: videoPlaylistPageView(
                        String(playlist.id),
                        playlist.title,
                      ),
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
          playlistHref={videoPlaylistPageView(
            String(playlistId),
            playlist?.title,
          )}
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

          <Styled.VideoShareSection>
            {duration && (
              <Styled.StyledDuration>{duration}</Styled.StyledDuration>
            )}
            {video && (
              <StyledVideoShareButton
                video={video}
                title={video?.title ?? ""}
                pageUrl={`${NEXT_PUBLIC_ORIGIN}${videoDetailPageView(video.id, playlistId ?? undefined, video.title)}`}
                playerRef={playerRef}
              />
            )}
          </Styled.VideoShareSection>
          {/* Video player */}
          <StyledVideoResourcePlayer
            ref={playerRef}
            video={video}
            videoId={videoId}
            isLoading={isLoading}
            videoTitleLabel={videoTitleLabel}
            videoThumbnailAlt={videoThumbnailAlt}
          />

          {/* UP NEXT */}
          {!itemsLoading && nextVideo && video && (
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
