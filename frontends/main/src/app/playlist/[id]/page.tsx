import React from "react"
import type { Metadata } from "next"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { standardizeMetadata } from "@/common/metadata"
import {
  learningResourceQueries,
  videoPlaylistQueries,
} from "api/hooks/learningResources"
import { getQueryClient } from "@/app/getQueryClient"
import VideoPage from "@/app-pages/VideoPage/VideoPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Video Playlist",
})

type Props = {
  params: Promise<{ id: string }>
}

const Page: React.FC<Props> = async ({ params }) => {
  const { id } = await params
  const playlistId = Number(id)
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
      <VideoPage playlistId={playlistId} />
    </HydrationBoundary>
  )
}

export default Page
