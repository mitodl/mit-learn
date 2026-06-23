"use client"

import React from "react"
import { useQuery } from "@tanstack/react-query"
import { videoPlaylistQueries } from "api/hooks/learningResources"
import { isOcwPlaylist } from "@/common/utils"
import VideoDetailPage from "./VideoDetailPage"
import VideoSeriesDetailPage from "./VideoSeriesDetailPage"
import { LoadingSpinner } from "ol-components"

type VideoDetailPageRouterProps = {
  videoId: number
  playlistId: number | null
  startTime?: number
}

const VideoDetailPageRouter: React.FC<VideoDetailPageRouterProps> = ({
  videoId,
  playlistId,
  startTime,
}) => {
  const { data: playlist, isLoading: playlistLoading } = useQuery({
    ...videoPlaylistQueries.detail(playlistId ?? 0),
    enabled: playlistId !== null,
  })

  if (playlistId !== null && playlistLoading) {
    return <LoadingSpinner loading={playlistLoading} />
  }

  const isOcw = isOcwPlaylist(playlist)

  if (isOcw) {
    return (
      <VideoSeriesDetailPage
        videoId={videoId}
        playlistId={playlistId}
        playlistData={playlist}
        playlistLoading={playlistLoading}
      />
    )
  }

  return (
    <VideoDetailPage
      videoId={videoId}
      playlistId={playlistId}
      playlistData={playlist}
      playlistLoading={playlistLoading}
      startTime={startTime}
    />
  )
}

export default VideoDetailPageRouter
