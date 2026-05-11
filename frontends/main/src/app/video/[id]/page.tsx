import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { safeGenerateMetadata, standardizeMetadata } from "@/common/metadata"
import {
  learningResourceQueries,
  videoPlaylistQueries,
} from "api/hooks/learningResources"
import { getQueryClient } from "@/app/getQueryClient"
import VideoDetailPageRouter from "@/app-pages/VideoPlaylistCollectionPage/VideoDetailPageRouter"
import { notFound } from "next/navigation"
import type { VideoResource } from "api/v1"

export const generateMetadata = async (props: PageProps<"/video/[id]">) => {
  const { id } = await props.params
  const videoId = Number(id)
  if (!Number.isInteger(videoId) || videoId <= 0) {
    notFound()
  }
  const queryClient = getQueryClient()

  return safeGenerateMetadata(async () => {
    const resource = await queryClient.fetchQuery(
      learningResourceQueries.detail(videoId),
    )
    return standardizeMetadata({
      title: resource.title,
      description: resource.description ?? undefined,
      image: resource.image?.url,
      imageAlt: resource.image?.alt ?? undefined,
    })
  })
}

const Page: React.FC<PageProps<"/video/[id]">> = async ({
  params,
  searchParams,
}) => {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const videoId = Number(id)
  if (!Number.isInteger(videoId) || videoId <= 0) {
    notFound()
  }

  const queryClient = getQueryClient()

  const video = (await queryClient.fetchQueryOr404(
    learningResourceQueries.detail(videoId),
  )) as VideoResource

  // Resolve playlistId: prefer explicit ?playlist= param, fall back to video.playlists[0]
  let playlistId: number | null = null
  const rawPlaylist = resolvedSearchParams?.playlist

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
  } else {
    // Use the first playlist the video belongs to, if any
    const firstPlaylist = video.playlists?.[0]
    if (firstPlaylist !== undefined) {
      const parsed = Number(firstPlaylist)
      if (Number.isInteger(parsed) && parsed > 0) {
        playlistId = parsed
      }
    }
  }

  if (playlistId !== null) {
    await Promise.all([
      queryClient.fetchQueryOr404(videoPlaylistQueries.detail(playlistId)),
      queryClient.prefetchQuery(
        learningResourceQueries.items(playlistId, {
          learning_resource_id: playlistId,
        }),
      ),
    ])
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <VideoDetailPageRouter videoId={videoId} playlistId={playlistId} />
    </HydrationBoundary>
  )
}

export default Page
