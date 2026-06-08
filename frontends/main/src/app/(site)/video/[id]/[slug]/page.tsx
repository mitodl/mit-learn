import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { safeGenerateMetadata, standardizeMetadata } from "@/common/metadata"
import {
  learningResourceQueries,
  videoPlaylistQueries,
} from "api/hooks/learningResources"
import { getQueryClient } from "@/app/getQueryClient"
import VideoDetailPageRouter from "@/app-pages/VideoPlaylistCollectionPage/VideoDetailPageRouter"
import { notFound, redirect } from "next/navigation"
import { ResourceTypeEnum } from "api"
import type { VideoResource } from "api/v1"
import { parseResourceId, resolveVideoPlaylist } from "@/common/slugs"
import { absoluteUrl, videoDetailPageView } from "@/common/urls"

type Props = {
  params: Promise<{ id: string; slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const videoPlaylistIds = (video: VideoResource): number[] =>
  (video.playlists ?? [])
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)

export const generateMetadata = async (props: Props) => {
  const { id } = await props.params
  const searchParams = await props.searchParams
  const videoId = parseResourceId(id)
  if (videoId === null) {
    notFound()
  }
  const queryClient = getQueryClient()

  return safeGenerateMetadata(async () => {
    const resource = (await queryClient.fetchQuery(
      learningResourceQueries.detail(videoId),
    )) as VideoResource
    const playlistId = resolveVideoPlaylist(
      videoPlaylistIds(resource),
      searchParams?.playlist,
    )
    return standardizeMetadata({
      title: resource.title,
      description: resource.description ?? undefined,
      image: resource.image?.url,
      imageAlt: resource.image?.alt ?? undefined,
      alternates: {
        canonical: absoluteUrl(
          videoDetailPageView(videoId, playlistId ?? undefined, resource.title),
        ),
      },
    })
  })
}

const Page: React.FC<Props> = async ({ params, searchParams }) => {
  const { id, slug } = await params
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

  const rawPlaylist = resolvedSearchParams?.playlist
  const playlistId = resolveVideoPlaylist(videoPlaylistIds(video), rawPlaylist)

  // Canonical (slug + resolved playlist) is whatever the builder emits; redirect
  // if we're not on it. NOTE: when a redirect fires, only `?playlist` is carried
  // onto the canonical — any other incoming query params are intentionally
  // dropped (the spec promises query-param preservation only for the drawer).
  const canonical = videoDetailPageView(
    videoId,
    playlistId ?? undefined,
    video.title,
  )
  const incomingBase = `/video/${id}/${slug}`
  const incoming =
    typeof rawPlaylist === "string"
      ? `${incomingBase}?playlist=${rawPlaylist}`
      : incomingBase
  if (incoming !== canonical) {
    redirect(canonical)
  }

  if (playlistId !== null) {
    await Promise.all([
      queryClient.fetchQueryOr404(videoPlaylistQueries.detail(playlistId)),
      queryClient.prefetchQuery(
        learningResourceQueries.items(playlistId, {
          learning_resource_id: playlistId,
        }),
      ),
    ])
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <VideoDetailPageRouter videoId={videoId} playlistId={playlistId} />
    </HydrationBoundary>
  )
}

export default Page
