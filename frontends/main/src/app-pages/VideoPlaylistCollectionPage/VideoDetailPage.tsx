"use client"

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
import { absoluteUrl, videoDetailPath, videoPlaylistPath } from "@/common/urls"
import { buildVideoStructuredData } from "./videoStructuredData"
import type { VideoPlayerHandle } from "@/page-components/VideoPlayer/VideoResourcePlayer"
import { addExternalLinkTargets, isOcwPlaylist } from "@/common/utils"
import * as Styled from "./VideoDetailPage.styled"
import { isShortsList } from "./ShortsGrid"
import {
  VIDEO_PLAYLIST_PAGE_SIZE,
  VIDEO_SHORT_CATEGORY,
} from "@/common/constants"

/** How many sibling videos the "More from" list shows at most. */
const MORE_FROM_LIMIT = 5
/** Shorts show as cards: one row of 4 on desktop, two rows of 2 on phones. */
const MORE_FROM_SHORTS_LIMIT = 4

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
      // The playlist page's first page, which decides a shorts playlist.
      limit: VIDEO_PLAYLIST_PAGE_SIZE,
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

  const playlistVideos = (playlistItems ?? []).filter(
    (item): item is VideoResource =>
      item.resource_type === VideoResourceResourceTypeEnum.Video,
  )
  const totalPlaylistVideos = playlistVideos.length
  // Same rule as the playlist page, applied to the same first page of the
  // playlist (the current video included), so both pages agree on the layout.
  const isShortsPlaylist =
    !isOcwPlaylist(playlist) && isShortsList(playlistVideos)
  const otherVideos = playlistVideos
    .filter((item) => item.id !== videoId)
    .slice(0, isShortsPlaylist ? MORE_FROM_SHORTS_LIMIT : MORE_FROM_LIMIT)

  const isLoading = videoLoading || (!!playlistId && playlistLoading)

  const topicNames = topics
    .map((t) => t.name)
    .filter(Boolean)
    .join(" · ")

  // A vertical short gets its player beside the description, not above it.
  const isShort = video?.resource_category === VIDEO_SHORT_CATEGORY

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

  // A short's player sits beside its description; other videos' sit above it.
  const Player = isShort ? Styled.ShortPlayer : Styled.StyledVideoResourcePlayer
  const player = (
    <Player
      ref={playerRef}
      video={video}
      videoId={videoId}
      isLoading={isLoading}
      videoTitleLabel={videoTitleLabel}
      videoThumbnailAlt={videoThumbnailAlt}
      startTime={startTime}
    />
  )
  const description =
    !isLoading && video?.description ? (
      <Styled.DescriptionText
        component="div"
        id="video-description"
        $short={isShort}
        dangerouslySetInnerHTML={{
          __html: addExternalLinkTargets(video.description),
        }}
      />
    ) : null

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
                      href: playlist.learn_url,
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
            <Styled.CategoryLabel href={playlist.learn_url} $short={isShort}>
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
                <Styled.TopicText $short={isShort}>
                  {isShort
                    ? topics
                        .map((t) => t.name)
                        .filter(Boolean)
                        .join(" - ")
                    : topicNames}
                </Styled.TopicText>
              </Styled.MetaRow>
            )}

            {!isLoading && video && (
              <VideoShareButton
                video={video}
                title={video.title ?? "video"}
                // Shares the page in front of the user, playlist included: a
                // video in several playlists is viewable in any of them, and a
                // recommendation is usually about the series it was found in.
                pageUrl={absoluteUrl(
                  videoDetailPath(
                    video.id,
                    playlistId ?? undefined,
                    video.url_slug,
                  ),
                )}
                playerRef={playerRef}
              />
            )}
          </Styled.VideoShareSection>
          {isShort ? (
            <Styled.ShortBody>
              {player}
              {description && (
                <Styled.ShortAbout>
                  <Styled.AboutHeading>About this video</Styled.AboutHeading>
                  {description}
                </Styled.ShortAbout>
              )}
            </Styled.ShortBody>
          ) : (
            <>
              {player}
              {description}
            </>
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
                playlistHref={
                  playlist
                    ? playlist.learn_url
                    : videoPlaylistPath(playlistId, undefined)
                }
                videos={otherVideos}
                shorts={isShortsPlaylist}
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
