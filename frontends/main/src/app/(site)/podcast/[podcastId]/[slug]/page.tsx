import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { PodcastDetailPage } from "@/app-pages/PodcastPage/PodcastDetailPage"
import { getQueryClient } from "@/app/getQueryClient"
import { ResourceTypeEnum } from "api"
import { safeGenerateMetadata, standardizeMetadata } from "@/common/metadata"
import { learningResourceQueries } from "api/hooks/learningResources"
import { notFound, redirect } from "next/navigation"
import { parseResourceId } from "@/common/slugs"
import { absoluteUrl, carrySearchParams, podcastPageView } from "@/common/urls"

type Props = PageProps<"/podcast/[podcastId]/[slug]">

export const generateMetadata = async (props: Props) => {
  const { podcastId } = await props.params
  const id = parseResourceId(podcastId)
  if (id === null) {
    notFound()
  }
  const queryClient = getQueryClient()

  return safeGenerateMetadata(async () => {
    const resource = await queryClient.fetchQuery(
      learningResourceQueries.detail(id),
    )
    return standardizeMetadata({
      title: resource.title,
      description: resource.description ?? undefined,
      image: resource.image?.url,
      imageAlt: resource.image?.alt ?? undefined,
      alternates: {
        canonical: absoluteUrl(podcastPageView(String(id), resource.title)),
      },
    })
  })
}

const Page: React.FC<Props> = async (props) => {
  const { podcastId, slug } = await props.params
  const id = parseResourceId(podcastId)
  if (id === null) {
    notFound()
  }
  const queryClient = getQueryClient()
  const resource = await queryClient.fetchQueryOr404(
    learningResourceQueries.detail(id),
  )
  if (resource.resource_type !== ResourceTypeEnum.Podcast) {
    notFound()
  }

  // Canonical form is whatever the builder emits; redirect if we're not on it
  // (stale/uppercase slug, or a non-normalized id segment).
  const canonical = podcastPageView(String(id), resource.title)
  if (`/podcast/${podcastId}/${slug}` !== canonical) {
    redirect(carrySearchParams(canonical, await props.searchParams))
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PodcastDetailPage podcastId={String(id)} />
    </HydrationBoundary>
  )
}
export default Page
