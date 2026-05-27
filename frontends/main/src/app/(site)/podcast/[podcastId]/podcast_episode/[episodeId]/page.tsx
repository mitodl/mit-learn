import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { PodcastEpisodeDetailPage } from "@/app-pages/PodcastPage/PodcastEpisodeDetailPage"
import { getQueryClient } from "@/app/getQueryClient"
import { ResourceTypeEnum } from "api"
import { safeGenerateMetadata, standardizeMetadata } from "@/common/metadata"
import { learningResourceQueries } from "api/hooks/learningResources"
import { notFound } from "next/navigation"

export const generateMetadata = async (
  props: PageProps<"/podcast/[podcastId]/podcast_episode/[episodeId]">,
) => {
  const { episodeId } = await props.params
  const queryClient = getQueryClient()

  return safeGenerateMetadata(async () => {
    const resource = await queryClient.fetchQuery(
      learningResourceQueries.detail(Number(episodeId)),
    )
    return standardizeMetadata({
      title: resource.title,
      description: resource.description ?? undefined,
      image: resource.image?.url,
      imageAlt: resource.image?.alt ?? undefined,
    })
  })
}

const Page: React.FC<
  PageProps<"/podcast/[podcastId]/podcast_episode/[episodeId]">
> = async (props) => {
  const { episodeId, podcastId } = await props.params
  const episodeIdNumber = Number(episodeId)

  if (Number.isNaN(episodeIdNumber)) {
    notFound()
  }

  const queryClient = getQueryClient()

  const resource = await queryClient.fetchQueryOr404(
    learningResourceQueries.detail(episodeIdNumber),
  )
  if (resource.resource_type !== ResourceTypeEnum.PodcastEpisode) {
    notFound()
  }

  const podcastResource = await queryClient.fetchQueryOr404(
    learningResourceQueries.detail(Number(podcastId)),
  )
  if (podcastResource.resource_type !== ResourceTypeEnum.Podcast) {
    notFound()
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PodcastEpisodeDetailPage
        episodeId={episodeId}
        podcastId={typeof podcastId === "string" ? podcastId : null}
      />
    </HydrationBoundary>
  )
}

export default Page
