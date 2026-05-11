import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { learningResourceQueries } from "api/hooks/learningResources"
import { getQueryClient } from "@/app/getQueryClient"
import { notFound } from "next/navigation"
import { resolveVideoSources } from "@/app-pages/VideoPlaylistCollectionPage/videoSources"
import VideoEmbedPage from "@/app-pages/VideoEmbedPage/VideoEmbedPage"
import { VideoResourceResourceTypeEnum } from "api/v1"
import type { VideoResource } from "api/v1"

const Page = async ({
  params,
}: {
  params: Promise<{ id: string }>
}) => {
  const { id } = await params
  const videoId = Number(id)
  if (!Number.isInteger(videoId) || videoId <= 0) {
    notFound()
  }

  const queryClient = getQueryClient()
  const resource = await queryClient.fetchQueryOr404(
    learningResourceQueries.detail(videoId),
  )

  if (resource.resource_type !== VideoResourceResourceTypeEnum.Video) {
    notFound()
  }

  const videoResource = resource as VideoResource
  const sources = resolveVideoSources(
    videoResource.video?.streaming_url,
    videoResource.url,
    videoResource.content_files?.[0]?.youtube_id,
  )

  const SUPPORTED_TYPES = ["application/x-mpegURL", "video/mp4"]
  if (sources.length === 0 || !SUPPORTED_TYPES.includes(sources[0].type)) {
    notFound()
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <VideoEmbedPage videoId={videoId} />
    </HydrationBoundary>
  )
}

export default Page
