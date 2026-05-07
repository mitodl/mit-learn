"use client"

import React, { useEffect, useMemo, useRef } from "react"
import dynamic from "next/dynamic"
import Image from "next/image"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { Skeleton } from "ol-components"
import VideoContainer from "./VideoContainer"
import { useLearningResourcesDetail } from "api/hooks/learningResources"
import type { VideoResource, VideoPlaylistResource } from "api/v1"
import { formatDurationClockTime } from "ol-utilities"
import { resolveVideoSources, extractYouTubeId } from "./videoSources"
import type { VideoJsPlayerProps } from "./VideoJsPlayer"
import YouTubeIframePlayer from "./YouTubeIframePlayer"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { notFound } from "next/navigation"
import { useSeriesNavigation } from "./useSeriesNavigation"
import SeriesNavBar from "./SeriesNavBar"
import UpNextSection from "./UpNextSection"
import * as Styled from "./VideoSeriesDetailPage.styled"
import { buildVideoStructuredData } from "./videoStructuredData"

const VideoJsPlayer = dynamic<VideoJsPlayerProps>(
  () => import("./VideoJsPlayer"),
  { ssr: false },
)

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

  const captionUrls = video?.video?.caption_urls ?? []
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
          <Styled.PlayerWrapper
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
            ) : sources[0]?.type === "video/youtube" ? (
              <YouTubeIframePlayer
                key={videoId}
                videoId={extractYouTubeId(sources[0].src) ?? ""}
                ariaLabel={`Video: ${videoTitleLabel}`}
                ariaDescribedBy="video-description"
              />
            ) : sources.length > 0 ? (
              <VideoJsPlayer
                key={videoId}
                sources={sources}
                tracks={captionUrls}
                poster={
                  video?.video?.cover_image_url ??
                  video?.image?.url ??
                  undefined
                }
                autoplay={false}
                controls
                fluid={false}
                ariaLabel={`Video: ${videoTitleLabel}`}
                ariaDescribedBy="video-description"
              />
            ) : video?.image?.url ? (
              <Styled.ThumbnailWrapper>
                <Image
                  src={video.image.url}
                  alt={videoThumbnailAlt}
                  fill
                  sizes="100vw"
                  style={{ objectFit: "cover" }}
                />
              </Styled.ThumbnailWrapper>
            ) : (
              <>
                <Styled.ScreenReaderOnly role="alert" aria-live="polite">
                  No playable source available for this video.
                </Styled.ScreenReaderOnly>
                <Styled.NoVideoMessage>
                  No playable source available for this video.
                </Styled.NoVideoMessage>
              </>
            )}
          </Styled.PlayerWrapper>

          {/* UP NEXT */}
          {!itemsLoading && nextVideo && (
            <UpNextSection nextVideo={nextVideo} getVideoHref={getVideoHref} />
          )}

          {/* Description */}
          {!isLoading && video?.description && (
            <Styled.DescriptionText
              id="video-description"
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
