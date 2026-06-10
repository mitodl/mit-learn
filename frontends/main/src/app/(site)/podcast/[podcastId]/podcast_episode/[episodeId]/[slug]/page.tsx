import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { PodcastEpisodeDetailPage } from "@/app-pages/PodcastPage/PodcastEpisodeDetailPage"
import { getQueryClient } from "@/app/getQueryClient"
import { ResourceTypeEnum } from "api"
import { safeGenerateMetadata, standardizeMetadata } from "@/common/metadata"
import { learningResourceQueries } from "api/hooks/learningResources"
import { notFound, redirect } from "next/navigation"
import { parseResourceId, resolveEpisodeParent } from "@/common/slugs"
import {
  absoluteUrl,
  carrySearchParams,
  podcastEpisodePageView,
} from "@/common/urls"
import type { PodcastEpisodeResource } from "api/v1"

type Props =
  PageProps<"/podcast/[podcastId]/podcast_episode/[episodeId]/[slug]">

const parentPodcastIds = (episode: PodcastEpisodeResource): number[] =>
  (episode.podcast_episode?.podcasts ?? []).map(Number)

export const generateMetadata = async (props: Props) => {
  const { podcastId, episodeId } = await props.params
  const epId = parseResourceId(episodeId)
  const incomingPodcastId = parseResourceId(podcastId)
  if (epId === null || incomingPodcastId === null) {
    notFound()
  }
  const queryClient = getQueryClient()

  return safeGenerateMetadata(async () => {
    const resource = (await queryClient.fetchQuery(
      learningResourceQueries.detail(epId),
    )) as PodcastEpisodeResource
    // Best-effort: if there's no actual parent, fall back to the incoming id
    // (the Page itself 404s that case, so this canonical is moot).
    const canonicalPodcastId =
      resolveEpisodeParent(parentPodcastIds(resource), incomingPodcastId) ??
      incomingPodcastId
    return standardizeMetadata({
      title: resource.title,
      description: resource.description ?? undefined,
      image: resource.image?.url,
      imageAlt: resource.image?.alt ?? undefined,
      alternates: {
        canonical: absoluteUrl(
          podcastEpisodePageView(
            String(epId),
            String(canonicalPodcastId),
            resource.title,
          ),
        ),
      },
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
  const episode = (await queryClient.fetchQueryOr404(
    learningResourceQueries.detail(epId),
  )) as PodcastEpisodeResource
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

  // Canonical = correct parent id + episode slug. The full-path compare also
  // strips a stray slug from the bare podcast-id segment.
  const canonical = podcastEpisodePageView(
    String(epId),
    String(canonicalPodcastId),
    episode.title,
  )
  if (
    `/podcast/${podcastId}/podcast_episode/${episodeId}/${slug}` !== canonical
  ) {
    redirect(carrySearchParams(canonical, await props.searchParams))
  }

  // Hydrate the parent podcast (breadcrumb/header read its title client-side).
  await queryClient.fetchQueryOr404(
    learningResourceQueries.detail(canonicalPodcastId),
  )

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
