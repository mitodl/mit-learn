import { learningResourceQueries } from "api/hooks/learningResources"
import { getQueryClient } from "@/app/getQueryClient"
import { notFound, redirect } from "next/navigation"
import { ResourceTypeEnum } from "api"
import type { VideoResource } from "api/v1"
import { parseResourceId, resolveVideoPlaylist } from "@/common/slugs"
import { videoDetailPageView } from "@/common/urls"

/** Bare /video/{id} is never canonical → 307-redirect to slug + resolved playlist. */
const Page = async ({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) => {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const videoId = parseResourceId(id)
  if (videoId === null) {
    notFound()
  }
  const queryClient = getQueryClient()
  const video = (await queryClient.fetchQueryOr404(
    learningResourceQueries.detail(videoId),
  )) as VideoResource
  if (video.resource_type !== ResourceTypeEnum.Video) {
    notFound()
  }
  const playlistIds = (video.playlists ?? [])
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
  const playlistId = resolveVideoPlaylist(
    playlistIds,
    resolvedSearchParams?.playlist,
  )
  redirect(videoDetailPageView(videoId, playlistId ?? undefined, video.title))
}

export default Page
