import React from "react"
import { Skeleton } from "ol-components"
import { RiArrowLeftLine, RiArrowRightLine } from "@remixicon/react"
import type { VideoResource } from "api/v1"
import type { SeriesNavigation } from "./useSeriesNavigation"
import * as Styled from "./VideoSeriesDetailPage.styled"

type SeriesNavBarProps = {
  playlistId: number
  playlistLabel: string
  videoId: number
  isLoading: boolean
} & Pick<
  SeriesNavigation,
  | "videoItems"
  | "currentIndex"
  | "videoPosition"
  | "prevVideo"
  | "nextVideo"
  | "getVideoHref"
>

const SeriesNavBar: React.FC<SeriesNavBarProps> = ({
  playlistId,
  playlistLabel,
  videoId,
  isLoading,
  videoItems,
  currentIndex,
  videoPosition,
  prevVideo,
  nextVideo,
  getVideoHref,
}) => {
  return (
    <Styled.SeriesNavBar>
      {/* Top row: series title + video position */}
      <Styled.SeriesNavTopRow>
        <Styled.SeriesNavTitle href={`/video-playlist/${playlistId}`}>
          {isLoading ? <Skeleton width={200} height={20} /> : playlistLabel}
        </Styled.SeriesNavTitle>
        {!isLoading && videoPosition !== null && videoItems.length > 0 && (
          <Styled.VideoPositionLabel>
            Video {videoPosition} of {videoItems.length}
          </Styled.VideoPositionLabel>
        )}
      </Styled.SeriesNavTopRow>

      {/* Segmented progress bar */}
      {!isLoading && videoItems.length > 0 && (
        <Styled.ProgressBarRow>
          {videoItems.map((item: VideoResource, i: number) => (
            <Styled.ProgressSegment
              key={item.id}
              $active={item.id === videoId}
              $done={currentIndex >= 0 && i < currentIndex}
            />
          ))}
        </Styled.ProgressBarRow>
      )}

      {/* Bottom row: prev / next text links */}
      <Styled.SeriesNavBottomRow>
        {prevVideo ? (
          <Styled.NavLink href={getVideoHref(prevVideo)}>
            <Styled.NavArrowIcon>
              <RiArrowLeftLine size={16} />
            </Styled.NavArrowIcon>
            <Styled.NavLinkText>Previous: {prevVideo.title}</Styled.NavLinkText>
          </Styled.NavLink>
        ) : (
          <span />
        )}
        {nextVideo && (
          <Styled.NavLink
            href={getVideoHref(nextVideo)}
            style={{ justifyContent: "flex-end" }}
          >
            <Styled.NavLinkText>Next: {nextVideo.title}</Styled.NavLinkText>
            <Styled.NavArrowIcon>
              <RiArrowRightLine size={16} />
            </Styled.NavArrowIcon>
          </Styled.NavLink>
        )}
      </Styled.SeriesNavBottomRow>
    </Styled.SeriesNavBar>
  )
}

export default SeriesNavBar
