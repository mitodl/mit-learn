"use client"

import { env } from "@/env"
import React, { useEffect, useRef } from "react"
import { Skeleton, SkipLink } from "ol-components"
import VideoContainer from "./VideoContainer"
import VideoShareButton from "./VideoShareButton"
import MoreFromPlaylist from "./MoreFromPlaylist"
import { useQuery } from "@tanstack/react-query"
import {
  useLearningResourcesDetail,
  learningResourceQueries,
} from "api/hooks/learningResources"
import type { VideoResource, VideoPlaylistResource } from "api/v1"
import { VideoResourceResourceTypeEnum } from "api/v1"
import { formatDurationClockTime } from "ol-utilities"
import { videoDetailPageView, videoPlaylistPageView } from "@/common/urls"
import { buildVideoStructuredData } from "./videoStructuredData"
import type { VideoPlayerHandle } from "./VideoResourcePlayer"
import * as Styled from "./VideoDetailPage.styled"

const NEXT_PUBLIC_ORIGIN = env("NEXT_PUBLIC_ORIGIN")

/** How many sibling videos the "More from" list shows at most. */
const MORE_FROM_LIMIT = 5

type VideoDetailPageProps = {
  videoId: number
  playlistId: number | null
  playlistData?: VideoPlaylistResource
  playlistLoading: boolean
  startTime?: number
}

const VideoDetailPage: React.FC<VideoDetailPageProps> = ({
  videoId,
  playlistId,
  playlistData,
  playlistLoading,
  startTime,
}) => {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const playerRef = useRef<VideoPlayerHandle | null>(null)

  const { data: resource, isLoading: videoLoading } =
    useLearningResourcesDetail(videoId)

  const { data: playlistItems, isLoading: itemsLoading } = useQuery({
    ...learningResourceQueries.items(playlistId ?? 0, {
      learning_resource_id: playlistId ?? 0,
    }),
    enabled: !!playlistId,
  })

  const playlist = playlistData as VideoPlaylistResource | undefined
  const video = resource as VideoResource | undefined

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
    .slice(0, MORE_FROM_LIMIT)

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

  // VideoObject JSON-LD for Google search indexing.
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
        <SkipLink.Trigger targetId="video-detail-main">
          Skip to main content
        </SkipLink.Trigger>
        <SkipLink.Trigger targetId="video-player-region">
          Skip to video player
        </SkipLink.Trigger>
        {playlistId && (
          <SkipLink.Trigger targetId="more-from-playlist">
            Skip to more videos
          </SkipLink.Trigger>
        )}
      </Styled.SkipLinksNav>

      <Styled.ScreenReaderOnly
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {loadingStatusMessage}
      </Styled.ScreenReaderOnly>

      <Styled.BreadcrumbBar>
        <VideoContainer>
          <Styled.StyledBreadcrumbs
            variant="light"
            separatorStyle={{ margin: "0 4px" }}
            ancestors={[
              { href: "/", label: "Home" },
              ...(playlist
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

      <Styled.ContentArea id="video-detail-main" tabIndex={-1}>
        <VideoContainer>
          {isLoading ? (
            <Skeleton width={120} height={18} style={{ marginBottom: 8 }} />
          ) : playlist ? (
            <Styled.CategoryLabel
              href={videoPlaylistPageView(String(playlist.id), playlist.title)}
            >
              {playlistLabel}
            </Styled.CategoryLabel>
          ) : null}

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
            {!isLoading && (duration || topicNames) && (
              <Styled.MetaRow>
                <Styled.DurationText>
                  {duration && <span>{duration}</span>}
                </Styled.DurationText>
                <Styled.TopicText>{topicNames}</Styled.TopicText>
              </Styled.MetaRow>
            )}

            {!isLoading && video && (
              <VideoShareButton
                video={video}
                title={video.title ?? "video"}
                pageUrl={`${NEXT_PUBLIC_ORIGIN}${videoDetailPageView(video.id, playlistId ?? undefined, video.title)}`}
                playerRef={playerRef}
              />
            )}
          </Styled.VideoShareSection>
          <Styled.StyledVideoResourcePlayer
            ref={playerRef}
            video={video}
            videoId={videoId}
            isLoading={isLoading}
            videoTitleLabel={videoTitleLabel}
            videoThumbnailAlt={videoThumbnailAlt}
            startTime={startTime}
          />
          <Styled.BorderLine />

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

          {playlistId && (
            <section id="more-from-playlist" tabIndex={-1}>
              <MoreFromPlaylist
                playlistId={playlistId}
                playlistLabel={playlistLabel}
                playlistTitle={playlist?.title}
                videos={otherVideos}
                totalVideos={totalPlaylistVideos}
                isLoading={itemsLoading}
              />
            </section>
          )}
        </VideoContainer>
      </Styled.ContentArea>
    </Styled.PageWrapper>
  )
}

export default VideoDetailPage
