"use client"

import React, { useImperativeHandle, useMemo, useRef } from "react"
import dynamic from "next/dynamic"
import Image from "next/image"
import { Skeleton, styled } from "ol-components"
import { NoVideoMessage } from "./shared.styled"
import { resolveVideoSources } from "./videoSources"
import { convertToEmbedUrl } from "@/common/utils"
import YouTubeIframePlayer, {
  type YouTubePlayerHandle,
} from "./YouTubeIframePlayer"
import type { VideoResource } from "api/v1"
import type { VideoJsPlayerProps } from "./VideoJsPlayer"
import { trackVideoStart, trackVideo50Percent } from "@/common/analytics/gtm"
import type Player from "video.js/dist/types/player"

const VideoJsPlayer = dynamic<VideoJsPlayerProps>(
  () => import("./VideoJsPlayer"),
  { ssr: false },
)

const Wrapper = styled.div(({ theme }) => ({
  width: "100%",
  aspectRatio: "16/9",
  backgroundColor: "#000",
  overflow: "hidden",
  position: "relative",
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
  ".vjs-icon-placeholder": {
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

export type VideoPlayerHandle = {
  getCurrentTime: () => number
}

export type VideoResourcePlayerProps = {
  video: VideoResource | undefined
  videoId: number
  isLoading: boolean
  videoTitleLabel: string
  videoThumbnailAlt: string
  ariaDescribedBy?: string
  startTime?: number
  className?: string
}

/**
 * Renders the video player region: loading skeleton, YouTube iframe,
 * VideoJS player, thumbnail fallback, or no-source message.
 *
 * Accepts `className` so it can be extended with `styled(VideoResourcePlayer)`
 * for per-page layout overrides (e.g. margin, border).
 *
 * Exposes a `VideoPlayerHandle` ref so callers can read `getCurrentTime()`.
 * OVS (VideoJS) returns the actual playback position; YouTube returns 0
 * until the YouTube IFrame API is wired up.
 */
const VideoResourcePlayer = React.forwardRef<
  VideoPlayerHandle,
  VideoResourcePlayerProps
>(
  (
    {
      video,
      videoId,
      isLoading,
      videoTitleLabel,
      videoThumbnailAlt,
      ariaDescribedBy = "video-description",
      startTime,
      className,
    },
    ref,
  ) => {
    const vjsPlayerRef = useRef<Player | null>(null)
    const ytPlayerRef = useRef<YouTubePlayerHandle | null>(null)

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

    const captionUrls = video?.video?.caption_urls ?? []

    const embedUrl =
      sources[0]?.type === "video/youtube"
        ? convertToEmbedUrl(sources[0].src)
        : null

    useImperativeHandle(
      ref,
      () => ({
        getCurrentTime: () =>
          embedUrl
            ? (ytPlayerRef.current?.getCurrentTime() ?? 0)
            : (vjsPlayerRef.current?.currentTime() ?? 0),
      }),
      [embedUrl],
    )

    const thumbnailUrl =
      video?.image?.url ?? video?.content_files?.[0]?.image_src ?? null

    const posterUrl =
      video?.video?.cover_image_url ??
      video?.content_files?.[0]?.image_src ??
      video?.image?.url ??
      undefined

    return (
      <Wrapper
        id="video-player-region"
        tabIndex={-1}
        role="region"
        aria-label={`Video player for ${videoTitleLabel}`}
        aria-describedby={ariaDescribedBy}
        className={className}
      >
        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            aria-label="Loading video player"
          >
            <Skeleton variant="rectangular" width="100%" height="100%" />
          </div>
        ) : embedUrl ? (
          <YouTubeIframePlayer
            key={`${videoId}-${embedUrl}-${startTime}`}
            ref={ytPlayerRef}
            embedUrl={embedUrl}
            ariaLabel={`Video: ${videoTitleLabel}`}
            ariaDescribedBy={ariaDescribedBy}
            startTime={startTime}
          />
        ) : sources.length > 0 ? (
          <VideoJsPlayer
            key={videoId}
            sources={sources}
            tracks={captionUrls}
            poster={posterUrl}
            autoplay={false}
            controls
            fluid={false}
            ariaLabel={`Video: ${videoTitleLabel}`}
            ariaDescribedBy={ariaDescribedBy}
            startTime={startTime}
            onReady={(player) => {
              vjsPlayerRef.current = player
            }}
            onPlay={() => trackVideoStart(videoTitleLabel)}
            onHalfProgress={() => trackVideo50Percent(videoTitleLabel)}
          />
        ) : thumbnailUrl ? (
          <ThumbnailWrapper>
            <Image
              src={thumbnailUrl}
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
      </Wrapper>
    )
  },
)

VideoResourcePlayer.displayName = "VideoResourcePlayer"
export default VideoResourcePlayer
