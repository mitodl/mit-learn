import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { learningResourceQueries } from "api/hooks/learningResources"
import { getQueryClient } from "@/app/getQueryClient"
import { notFound } from "next/navigation"
import VideoEmbedPage from "@/app-pages/VideoEmbedPage/VideoEmbedPage"
import { VideoResourceResourceTypeEnum } from "api/v1"
import type { VideoResource } from "api/v1"
import {
  safeGenerateMetadata,
  standardizeMetadata,
  MetadataNotFound,
} from "@/common/metadata"

export const generateMetadata = ({
  params,
}: {
  params: Promise<{ id: string }>
}) =>
  safeGenerateMetadata(async () => {
    const { id } = await params
    const videoId = Number(id)
    if (!Number.isInteger(videoId) || videoId <= 0) {
      throw new MetadataNotFound()
    }
    const queryClient = getQueryClient()
    const resource = await queryClient
      .fetchQuery(learningResourceQueries.detail(videoId))
      .catch(() => {
        throw new MetadataNotFound()
      })

    if (resource?.resource_type !== VideoResourceResourceTypeEnum.Video) {
      throw new MetadataNotFound()
    }

    return standardizeMetadata({
      title: resource.title,
      robots: "noindex, nofollow",
      social: false,
    })
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

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <VideoEmbedPage videoResource={resource as VideoResource} />
    </HydrationBoundary>
  )
}

export default Page
