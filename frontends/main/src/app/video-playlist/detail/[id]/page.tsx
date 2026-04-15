import React from "react"
import type { Metadata } from "next"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { standardizeMetadata } from "@/common/metadata"
import {
  learningResourceQueries,
  videoPlaylistQueries,
} from "api/hooks/learningResources"
import { getQueryClient } from "@/app/getQueryClient"
import VideoDetailPage from "@/app-pages/VideoPlaylistCollectionPage/VideoDetailPage"
import { notFound } from "next/navigation"

export const metadata: Metadata = standardizeMetadata({
  title: "Video Detail",
})

const Page: React.FC<PageProps<"/video-playlist/detail/[id]">> = async ({
  params,
  searchParams,
}) => {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const videoId = Number(id)
  if (!Number.isInteger(videoId) || videoId <= 0) {
    notFound()
  }

  const rawPlaylist = resolvedSearchParams?.playlist
  let playlistId: number | null = null
  if (rawPlaylist !== undefined) {
    // searchParams values can be string | string[]; treat array as invalid
    if (Array.isArray(rawPlaylist)) {
      notFound()
    }
    const parsed = Number(rawPlaylist)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      notFound()
    }
    playlistId = parsed
  }

  const queryClient = getQueryClient()

  await queryClient.fetchQueryOr404(learningResourceQueries.detail(videoId))

  const prefetches: Promise<unknown>[] = []

  if (playlistId !== null) {
    prefetches.push(
      queryClient.fetchQueryOr404(videoPlaylistQueries.detail(playlistId)),
      queryClient.prefetchQuery(
        learningResourceQueries.items(playlistId, {
          learning_resource_id: playlistId,
        }),
      ),
    )
  }

  await Promise.all(prefetches)

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <VideoDetailPage videoId={videoId} playlistId={playlistId} />
    </HydrationBoundary>
  )
}

export default Page
