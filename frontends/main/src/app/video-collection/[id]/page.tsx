import React from "react"
import type { Metadata } from "next"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { standardizeMetadata } from "@/common/metadata"
import {
  learningResourceQueries,
  videoPlaylistQueries,
} from "api/hooks/learningResources"
import { getQueryClient } from "@/app/getQueryClient"
import VideoPlaylistCollectionPage from "@/app-pages/VideoPlaylistCollectionPage/VideoPlaylistCollectionPage"
import { notFound } from "next/navigation"

export const metadata: Metadata = standardizeMetadata({
  title: "Video Playlist",
  robots: "noindex, nofollow",
})

const Page: React.FC<PageProps<"/video-collection/[id]">> = async ({
  params,
}) => {
  const { id } = await params
  const playlistId = Number(id)
  if (Number.isNaN(playlistId)) {
    notFound()
  }
  const queryClient = getQueryClient()

  await Promise.all([
    queryClient.prefetchQuery(videoPlaylistQueries.detail(playlistId)),
    queryClient.prefetchQuery(
      learningResourceQueries.items(playlistId, {
        learning_resource_id: playlistId,
      }),
    ),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <VideoPlaylistCollectionPage playlistId={playlistId} />
    </HydrationBoundary>
  )
}

export default Page
