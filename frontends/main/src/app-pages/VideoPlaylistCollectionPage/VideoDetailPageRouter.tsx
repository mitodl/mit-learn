"use client"

import React from "react"
import { useQuery } from "@tanstack/react-query"
import { videoPlaylistQueries } from "api/hooks/learningResources"
import { isOcwPlaylist } from "@/common/utils"
import VideoDetailPage from "./VideoDetailPage"
import VideoSeriesDetailPage from "./VideoSeriesDetailPage"

type VideoDetailPageRouterProps = {
  videoId: number
  playlistId: number | null
}

const VideoDetailPageRouter: React.FC<VideoDetailPageRouterProps> = ({
  videoId,
  playlistId,
}) => {
  const { data: playlist, isLoading: playlistLoading  } = useQuery({
    ...videoPlaylistQueries.detail(playlistId ?? 0),
    enabled: playlistId !== null,
  })

  const isOcw = isOcwPlaylist(playlist)

  if (isOcw) {
    return <VideoSeriesDetailPage 
    videoId={videoId} 
    playlistId={playlistId} 
    playlistData={playlist} 
    playlistLoading={playlistLoading} 
    />
  }

  return <VideoDetailPage 
  videoId={videoId} 
  playlistId={playlistId}
   playlistData={playlist} 
    playlistLoading={playlistLoading}  />
}

export default VideoDetailPageRouter
