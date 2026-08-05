import React from "react"
import Image from "next/image"
import { Skeleton } from "ol-components"
import { formatDurationClockTime } from "ol-utilities"
import type { VideoResource } from "api/v1"
import { videoDetailPageView, videoPlaylistPageView } from "@/common/urls"
import * as Styled from "./VideoDetailPage.styled"

type MoreFromPlaylistProps = {
  playlistId: number
  /** Display name of the playlist, used in headings and labels. */
  playlistLabel: string
  playlistTitle?: string
  /** Sibling videos to list, already filtered and capped by the caller. */
  videos: VideoResource[]
  /** Total videos in the playlist, used to decide whether to link to the rest. */
  totalVideos: number
  isLoading: boolean
}

/** One row: thumbnail with duration badge and hover overlay, plus title/description. */
const MoreFromPlaylistItem: React.FC<{
  video: VideoResource
  playlistId: number
}> = ({ video, playlistId }) => {
  const duration = video.video?.duration
    ? formatDurationClockTime(video.video.duration)
    : null
  const imageUrl = video.image?.url ?? null
  const topicNames = (video.topics ?? [])
    .map((topic) => topic.name)
    .filter(Boolean)
    .join(" · ")

  return (
    <Styled.MoreFromItem
      href={videoDetailPageView(video.id, playlistId, video.title)}
      aria-label={`Open video ${video.title}`}
    >
      <Styled.ThumbnailWrapper>
        {imageUrl && (
          <Image
            src={imageUrl}
            alt={`Video thumbnail for ${video.title}. Duration: ${duration || "Unknown duration"}. Topics: ${topicNames || "No topics listed"}`}
            fill
            sizes="160px"
            style={{ objectFit: "cover" }}
          />
        )}
        {duration && (
          <Styled.DurationBadge $dense>{duration}</Styled.DurationBadge>
        )}
        <Styled.PlayOverlay className="play-overlay">
          <Styled.PlayIcon />
        </Styled.PlayOverlay>
      </Styled.ThumbnailWrapper>
      <Styled.MoreFromTextSide>
        <Styled.MoreFromItemTitle className="mf-title">
          {video.title}
        </Styled.MoreFromItemTitle>
        {video.description && (
          <Styled.MoreFromItemMeta
            dangerouslySetInnerHTML={{ __html: video.description }}
          />
        )}
      </Styled.MoreFromTextSide>
    </Styled.MoreFromItem>
  )
}

/**
 * "More from <playlist>" — the sibling-video list at the foot of the video detail
 * page. Renders nothing once loaded if the playlist has no other videos.
 */
const MoreFromPlaylist: React.FC<MoreFromPlaylistProps> = ({
  playlistId,
  playlistLabel,
  playlistTitle,
  videos,
  totalVideos,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <>
        <Skeleton
          variant="text"
          width={220}
          height={24}
          style={{ marginBottom: 8 }}
        />
        {Array.from({ length: 3 }).map((_, i) => (
          <Styled.MoreFromSkeletonRow key={i}>
            <Skeleton variant="rectangular" width={160} height={90} />
            <div style={{ flex: 1 }}>
              <Skeleton variant="text" width="70%" height={20} />
              <Skeleton variant="text" width="50%" height={16} />
            </div>
          </Styled.MoreFromSkeletonRow>
        ))}
      </>
    )
  }

  if (videos.length === 0) return null

  // +1 accounts for the video currently being watched, which is excluded from
  // `videos` — without it a fully-listed playlist would still offer "View all".
  const hasMore = totalVideos > videos.length + 1

  return (
    <>
      <Styled.MoreFromTitle>More from {playlistLabel}</Styled.MoreFromTitle>
      <Styled.MoreFromList>
        {videos.map((video) => (
          <React.Fragment key={video.id}>
            <MoreFromPlaylistItem video={video} playlistId={playlistId} />
            <Styled.SpacerBlock className="spacer-block" />
          </React.Fragment>
        ))}
      </Styled.MoreFromList>
      {hasMore && (
        <Styled.SeeAllLink
          href={videoPlaylistPageView(String(playlistId), playlistTitle)}
          aria-label={`View all videos in ${playlistLabel}`}
        >
          View all in {playlistLabel} →
        </Styled.SeeAllLink>
      )}
    </>
  )
}

export default MoreFromPlaylist
