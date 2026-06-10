import { getQueryClient } from "@/app/getQueryClient"
import { ResourceTypeEnum } from "api"
import { learningResourceQueries } from "api/hooks/learningResources"
import { notFound, redirect } from "next/navigation"
import { parseResourceId, resolveEpisodeParent } from "@/common/slugs"
import { podcastEpisodePageView } from "@/common/urls"
import type { PodcastEpisodeResource } from "api/v1"

/**
 * Bare /podcast/{podcastId}/podcast_episode/{episodeId} is never canonical →
 * 307-redirect to the slugged form, correcting the parent podcast id.
 */
const Page = async (
  props: PageProps<"/podcast/[podcastId]/podcast_episode/[episodeId]">,
) => {
  const { podcastId, episodeId } = await props.params
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
  const canonicalPodcastId = resolveEpisodeParent(
    (episode.podcast_episode?.podcasts ?? []).map(Number),
    incomingPodcastId,
  )
  if (canonicalPodcastId === null) {
    notFound()
  }
  redirect(
    podcastEpisodePageView(
      String(epId),
      String(canonicalPodcastId),
      episode.title,
    ),
  )
}

export default Page
