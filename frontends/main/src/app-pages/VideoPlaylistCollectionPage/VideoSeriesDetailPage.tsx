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
import { resolveVideoSources } from "./videoSources"
import type { VideoJsPlayerProps } from "./VideoJsPlayer"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { notFound } from "next/navigation"
import { useSeriesNavigation } from "./useSeriesNavigation"
import SeriesNavBar from "./SeriesNavBar"
import UpNextSection from "./UpNextSection"
import MetaRow from "./MetaRow"
import TopicChips from "./TopicChips"
import * as Styled from "./VideoSeriesDetailPage.styled"

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

  const topics = video?.topics ?? []
  const captionUrls = video?.video?.caption_urls ?? []
  const playlistLabel = playlist?.title || "Video Collection"

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
  ) as string[]

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

  useEffect(() => {
    if (!isLoading) {
      titleRef.current?.focus()
    }
  }, [isLoading, videoId])

  // VideoObject JSON-LD for Google search indexing.
  // Rendered as a plain <script> tag so Googlebot can read it without executing
  // any additional JS. The replace guard prevents </script> injection.
  const structuredData =
    !isLoading && video
      ? {
          "@context": "https://schema.org",
          "@type": "VideoObject",
          name: video.title,
          ...(video.description ? { description: video.description } : {}),
          thumbnailUrl:
            video.video?.cover_image_url || video.image?.url || undefined,
          contentUrl: video.url ?? undefined,
          ...(video.video?.duration
            ? { duration: video.video.duration }
            : {}),
          ...(captionUrls.length > 0
            ? { accessibilityFeature: ["captions"] }
            : {}),
        }
      : null

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
          {/* Institution / category label */}
          {isLoading ? (
            <Skeleton width={280} height={16} style={{ marginBottom: 8 }} />
          ) : institutionLabel ? (
            <Styled.InstitutionLabel>
              {institutionLabel}
            </Styled.InstitutionLabel>
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
            <Styled.VideoTitle ref={titleRef} tabIndex={-1}>
              {video?.title}
            </Styled.VideoTitle>
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
            ) : sources.length > 0 ? (
              <VideoJsPlayer
                key={videoId}
                sources={sources}
                tracks={captionUrls}
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

          {/* Meta row */}
          {!isLoading && (
            <MetaRow
              metaParts={metaParts}
              instructorNames={instructorNames}
              departmentName={departmentName}
              duration={duration}
              term={term}
            />
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
              {videoTitleLabel}. Duration: {durationLabel}. Topics:{" "}
              {topicNamesLabel}.
            </Styled.ScreenReaderOnly>
          )}

          {/* Caption track links – visually hidden but present in the DOM so
              Googlebot can follow each VTT URL and index the caption text,
              associating the transcript content with this video page. */}
          {!isLoading && captionUrls.length > 0 && (
            <Styled.ScreenReaderOnly as="div">
              <p>Captions available for this video:</p>
              <ul>
                {captionUrls.map((track) => (
                  <li key={track.language}>
                    <a href={track.url}>
                      {track.language_name || track.language} captions (VTT)
                    </a>
                  </li>
                ))}
              </ul>
            </Styled.ScreenReaderOnly>
          )}

          {/* Topic chips */}
          {!isLoading && <TopicChips topics={topics} />}
        </VideoContainer>
      </Styled.ContentArea>
    </Styled.PageWrapper>
  )
}

export default VideoSeriesDetailPage
