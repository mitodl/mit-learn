import React from "react"
import type { Metadata } from "next"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { standardizeMetadata } from "@/common/metadata"
import {
  learningResourceQueries,
  videoPlaylistQueries,
} from "api/hooks/learningResources"
import { getQueryClient } from "@/app/getQueryClient"
import VideoDetailPage from "@/app-pages/VideoPage/VideoDetailPage"
import { notFound } from "next/navigation"

export const metadata: Metadata = standardizeMetadata({
  title: "Video Detail",
})

const Page: React.FC<PageProps<"/playlist/detail/[id]">> = async ({
  params,
  searchParams,
}) => {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const videoId = Number(id)
  if (Number.isNaN(videoId)) {
    notFound()
  }

  const playlistId = resolvedSearchParams?.playlist
    ? Number(resolvedSearchParams.playlist)
    : null

  const queryClient = getQueryClient()

  const prefetches: Promise<unknown>[] = [
    queryClient.prefetchQuery(learningResourceQueries.detail(videoId)),
  ]

  if (playlistId && !Number.isNaN(playlistId)) {
    prefetches.push(
      queryClient.prefetchQuery(videoPlaylistQueries.detail(playlistId)),
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
