import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { PodcastEpisodeDetailPage } from "@/app-pages/PodcastPage/PodcastEpisodeDetailPage"
import { getQueryClient } from "@/app/getQueryClient"
import { ResourceTypeEnum } from "api"
import { safeGenerateMetadata, standardizeMetadata } from "@/common/metadata"
import { learningResourceQueries } from "api/hooks/learningResources"
import { notFound } from "next/navigation"

export const generateMetadata = async (
  props: PageProps<"/podcast/detail/[id]">,
) => {
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

const Page: React.FC<PageProps<"/podcast/detail/[id]">> = async (props) => {
  const { id } = await props.params
  const searchParams = await props.searchParams
  const podcastId = searchParams["podcast"]
  const episodeId = Number(id)

  if (Number.isNaN(episodeId)) {
    notFound()
  }

  const queryClient = getQueryClient()

  const resource = await queryClient.fetchQueryOr404(
    learningResourceQueries.detail(episodeId),
  )
  if (resource.resource_type !== ResourceTypeEnum.PodcastEpisode) {
    notFound()
  }

  // Pre-fetch the parent podcast if provided so the client gets it instantly
  if (podcastId && !Number.isNaN(Number(podcastId))) {
    await queryClient.prefetchQuery(
      learningResourceQueries.detail(Number(podcastId)),
    )
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PodcastEpisodeDetailPage
        episodeId={id}
        podcastId={typeof podcastId === "string" ? podcastId : null}
      />
    </HydrationBoundary>
  )
}

export default Page
