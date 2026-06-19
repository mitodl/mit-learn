import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { learningResourceQueries } from "api/hooks/learningResources"
import { getQueryClient } from "@/app/getQueryClient"
import { notFound } from "next/navigation"
import PodcastEmbedPlayer from "@/app-pages/PodcastPage/PodcastEmbedPlayer"
import { ResourceTypeEnum } from "api/v1"
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
    const episodeId = Number(id)
    if (!Number.isInteger(episodeId) || episodeId <= 0) {
      throw new MetadataNotFound()
    }
    const queryClient = getQueryClient()
    const resource = await queryClient
      .fetchQuery(learningResourceQueries.detail(episodeId))
      .catch(() => {
        throw new MetadataNotFound()
      })

    if (resource?.resource_type !== ResourceTypeEnum.PodcastEpisode) {
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
  const episodeId = Number(id)
  if (!Number.isInteger(episodeId) || episodeId <= 0) {
    notFound()
  }

  const queryClient = getQueryClient()
  const resource = await queryClient.fetchQueryOr404(
    learningResourceQueries.detail(episodeId),
  )

  if (resource.resource_type !== ResourceTypeEnum.PodcastEpisode) {
    notFound()
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PodcastEmbedPlayer resource={resource} />
    </HydrationBoundary>
  )
}

export default Page
