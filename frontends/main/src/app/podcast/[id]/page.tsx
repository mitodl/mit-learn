import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { PodcastDetailPage } from "@/app-pages/PodcastPage/PodcastDetailPage"
import { getQueryClient } from "@/app/getQueryClient"
import { ResourceTypeEnum } from "api"
import { safeGenerateMetadata, standardizeMetadata } from "@/common/metadata"
import { learningResourceQueries } from "api/hooks/learningResources"
import { notFound } from "next/navigation"

export const generateMetadata = async (props: PageProps<"/podcast/[id]">) => {
  const { id } = await props.params
  const queryClient = getQueryClient()

  return safeGenerateMetadata(async () => {
    const resource = await queryClient.fetchQuery(
      learningResourceQueries.detail(Number(id)),
    )
    return standardizeMetadata({
      title: resource.title,
      description: resource.description ?? undefined,
      image: resource.image?.url,
      imageAlt: resource.image?.alt ?? undefined,
    })
  })
}

const Page: React.FC<PageProps<"/podcast/[id]">> = async (props) => {
  const { id } = await props.params
  const queryClient = getQueryClient()

  const podcastId = Number(id)
  if (Number.isNaN(podcastId)) {
    notFound()
  }
  const resource = await queryClient.fetchQueryOr404(
    learningResourceQueries.detail(podcastId),
  )
  if (resource.resource_type !== ResourceTypeEnum.Podcast) {
    notFound()
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PodcastDetailPage podcastId={id} />
    </HydrationBoundary>
  )
}
export default Page
