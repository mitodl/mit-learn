import { learningResourceQueries } from "api/hooks/learningResources"
import { getQueryClient } from "@/app/getQueryClient"
import { notFound, redirect } from "next/navigation"
import { ResourceTypeEnum } from "api"
import {
  parseResourceId,
  resolveVideoPlaylist,
  videoPlaylistIds,
} from "@/common/slugs"
import { carrySearchParams, videoDetailPageView } from "@/common/urls"

/** Bare /video/{id} is never canonical → 307-redirect to slug + resolved playlist. */
const Page = async ({ params, searchParams }: PageProps<"/video/[id]">) => {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const videoId = parseResourceId(id)
  if (videoId === null) {
    notFound()
  }
  const queryClient = getQueryClient()
  const video = await queryClient.fetchQueryOr404(
    learningResourceQueries.detail(videoId),
  )
  if (video.resource_type !== ResourceTypeEnum.Video) {
    notFound()
  }
  const playlistId = resolveVideoPlaylist(
    videoPlaylistIds(video),
    resolvedSearchParams?.playlist,
  )
  redirect(
    carrySearchParams(
      videoDetailPageView(videoId, playlistId ?? undefined, video.title),
      resolvedSearchParams,
      ["playlist"],
    ),
  )
}

export default Page
