import type { AppPageProps } from "@/common/searchParams"
import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { PodcastEpisodeDetailPage } from "@/app-pages/PodcastPage/PodcastEpisodeDetailPage"
import { getQueryClient } from "@/app/getQueryClient"
import { ResourceTypeEnum } from "api"
import {
  MetadataNotFound,
  safeGenerateMetadata,
  standardizeMetadata,
} from "@/common/metadata"
import { learningResourceQueries } from "api/hooks/learningResources"
import { notFound, redirect } from "next/navigation"
import {
  parentPodcastIds,
  parseResourceId,
  resolveEpisodeParent,
} from "@/common/slugs"
import {
  carrySearchParams,
  learnUrlSlug,
  podcastEpisodePath,
} from "@/common/urls"

type Props =
  AppPageProps<"/podcast/[podcastId]/podcast_episode/[episodeId]/[slug]">

export const generateMetadata = async (props: Props) => {
  const { podcastId, episodeId } = await props.params
  const epId = parseResourceId(episodeId)
  const incomingPodcastId = parseResourceId(podcastId)
  if (epId === null || incomingPodcastId === null) {
    notFound()
  }
  const queryClient = getQueryClient()

  return safeGenerateMetadata(async () => {
    const resource = await queryClient.fetchQuery(
      learningResourceQueries.detail(epId),
    )
    if (resource.resource_type !== ResourceTypeEnum.PodcastEpisode) {
      throw new MetadataNotFound()
    }
    return standardizeMetadata({
      title: resource.title,
      description: resource.description ?? undefined,
      image: resource.image?.url,
      imageAlt: resource.image?.alt ?? undefined,
      // One canonical per episode, whichever parent podcast it is viewed under.
      alternates: { canonical: resource.learn_url },
    })
  })
}

const Page: React.FC<Props> = async (props) => {
  const { podcastId, episodeId, slug } = await props.params
  const epId = parseResourceId(episodeId)
  const incomingPodcastId = parseResourceId(podcastId)
  if (epId === null || incomingPodcastId === null) {
    notFound()
  }

  const queryClient = getQueryClient()
  const episode = await queryClient.fetchQueryOr404(
    learningResourceQueries.detail(epId),
  )
  if (episode.resource_type !== ResourceTypeEnum.PodcastEpisode) {
    notFound()
  }

  // Episode id is authoritative; the podcast id segment is corrected (not 404'd)
  // to the episode's actual parent. No parent at all → no canonical URL → 404.
  const canonicalPodcastId = resolveEpisodeParent(
    parentPodcastIds(episode),
    incomingPodcastId,
  )
  if (canonicalPodcastId === null) {
    notFound()
  }

  // The backend names the slug; the parent podcast is resolved against the
  // request, since an episode in several podcasts is viewable under any of
  // them. The full-path compare also strips a stray slug from the bare
  // podcast-id segment.
  const canonical = podcastEpisodePath(
    String(epId),
    String(canonicalPodcastId),
    learnUrlSlug(episode.learn_url),
  )
  if (
    `/podcast/${podcastId}/podcast_episode/${episodeId}/${slug}` !== canonical
  ) {
    redirect(carrySearchParams(canonical, await props.searchParams))
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PodcastEpisodeDetailPage
        episodeId={String(epId)}
        podcastId={String(canonicalPodcastId)}
      />
    </HydrationBoundary>
  )
}

export default Page
