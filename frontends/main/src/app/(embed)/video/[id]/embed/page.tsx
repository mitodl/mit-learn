import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { learningResourceQueries } from "api/hooks/learningResources"
import { getQueryClient } from "@/app/getQueryClient"
import { notFound } from "next/navigation"
import { resolveVideoSources } from "@/app-pages/VideoPlaylistCollectionPage/videoSources"
import VideoEmbedPage from "@/app-pages/VideoEmbedPage/VideoEmbedPage"
import { VideoResourceResourceTypeEnum } from "api/v1"
import type { VideoResource } from "api/v1"
import { safeGenerateMetadata } from "@/common/metadata"
export const generateMetadata = ({
  params,
}: {
  params: Promise<{ id: string }>
}) =>
  safeGenerateMetadata(async () => {
    const { id } = await params
    const videoId = Number(id)
    if (!Number.isInteger(videoId) || videoId <= 0) {
      return { title: "Video" }
    }
    const queryClient = getQueryClient()
    // Catch here so errors don't propagate to safeGenerateMetadata, which
    // would call notFound() on 404s and prevent us from returning a title.
    const resource = await queryClient
      .fetchQuery(learningResourceQueries.detail(videoId))
      .catch(() => null)

    const SUPPORTED_TYPES = ["application/x-mpegURL", "video/mp4", "video/youtube"]
    const isEmbeddableVideo =
      resource?.resource_type === VideoResourceResourceTypeEnum.Video &&
      SUPPORTED_TYPES.includes(
        resolveVideoSources(
          (resource as VideoResource).video?.streaming_url,
          resource.url,
          resource.content_files?.[0]?.youtube_id,
        )[0]?.type ?? "",
      )

    return { title: isEmbeddableVideo ? (resource?.title ?? "Video") : "Video" }
  })

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
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

  const SUPPORTED_TYPES = ["application/x-mpegURL", "video/mp4", "video/youtube"]
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
