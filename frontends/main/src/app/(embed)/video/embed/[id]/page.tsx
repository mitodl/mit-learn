import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { learningResourceQueries } from "api/hooks/learningResources"
import { getQueryClient } from "@/app/getQueryClient"
import { notFound } from "next/navigation"
import VideoEmbedPage from "@/app-pages/VideoEmbedPage/VideoEmbedPage"
import { VideoResourceResourceTypeEnum } from "api/v1"
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

const Page = async ({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
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

  const resolvedSearch = await searchParams
  const rawT = resolvedSearch?.t
  const startTime =
    typeof rawT === "string" && /^\d+$/.test(rawT) ? Number(rawT) : undefined

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <VideoEmbedPage videoResource={resource} startTime={startTime} />
    </HydrationBoundary>
  )
}

export default Page
