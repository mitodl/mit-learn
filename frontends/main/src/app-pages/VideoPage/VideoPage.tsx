"use client"

import React, { useState, useCallback } from "react"
import { styled, Skeleton } from "ol-components"
import { useQuery } from "@tanstack/react-query"
import {
  learningResourceQueries,
  videoPlaylistQueries,
} from "api/hooks/learningResources"
import type { VideoResource, VideoPlaylistResource } from "api/v1"
import VideoPageHeader from "./VideoPageHeader"
import FeaturedVideo from "./FeaturedVideo"
import VideoCollection from "./VideoCollection"
import VideoPlayerModal from "./VideoPlayerModal"

const Page = styled.div({
  backgroundColor: "#fff",
  minHeight: "100vh",
})

type VideoPageProps = {
  playlistId: number
}

const VideoPage: React.FC<VideoPageProps> = ({ playlistId }) => {
  const [activeVideo, setActiveVideo] = useState<VideoResource | null>(null)

  const openVideo = useCallback((resource: VideoResource) => {
    setActiveVideo(resource)
  }, [])

  const closeVideo = useCallback(() => {
    setActiveVideo(null)
  }, [])

  const { data: playlistData, isLoading: playlistLoading } = useQuery(
    videoPlaylistQueries.detail(playlistId),
  )
  const playlist = playlistData as VideoPlaylistResource | undefined

  const { data: items, isLoading: itemsLoading } = useQuery(
    learningResourceQueries.items(playlistId, {
      learning_resource_id: playlistId,
    }),
  )

  const isLoading = playlistLoading || itemsLoading
  const videos = (items ?? []) as VideoResource[]
  const featuredVideo = videos[0] ?? null
  const collectionVideos = videos.slice(1)

  return (
    <Page>
      <VideoPageHeader playlist={playlist} />

      {isLoading ? (
        <Skeleton variant="rectangular" width="100%" height={460} />
      ) : featuredVideo ? (
        <FeaturedVideo video={featuredVideo} onPlay={openVideo} />
      ) : null}

      <VideoCollection
        videos={collectionVideos}
        isLoading={isLoading}
        onPlay={openVideo}
      />

      {activeVideo && (
        <VideoPlayerModal video={activeVideo} onClose={closeVideo} />
      )}
    </Page>
  )
}

export default VideoPage
