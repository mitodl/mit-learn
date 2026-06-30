import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import {
  MetadataNotFound,
  safeGenerateMetadata,
  standardizeMetadata,
} from "@/common/metadata"
import {
  learningResourceQueries,
  videoPlaylistQueries,
} from "api/hooks/learningResources"
import { getQueryClient } from "@/app/getQueryClient"
import VideoDetailPageRouter from "@/app-pages/VideoPlaylistCollectionPage/VideoDetailPageRouter"
import { notFound, redirect } from "next/navigation"
import { ResourceTypeEnum } from "api"
import {
  parseResourceId,
  resolveVideoPlaylist,
  videoPlaylistIds,
} from "@/common/slugs"
import {
  absoluteUrl,
  carrySearchParams,
  videoDetailPageView,
} from "@/common/urls"

type Props = PageProps<"/video/[id]/[slug]">

export const generateMetadata = async (props: Props) => {
  const { id } = await props.params
  const searchParams = await props.searchParams
  const videoId = parseResourceId(id)
  if (videoId === null) {
    notFound()
  }
  const queryClient = getQueryClient()

  return safeGenerateMetadata(async () => {
    const resource = await queryClient.fetchQuery(
      learningResourceQueries.detail(videoId),
    )
    if (resource.resource_type !== ResourceTypeEnum.Video) {
      throw new MetadataNotFound()
    }
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
  const video = await queryClient.fetchQueryOr404(
    learningResourceQueries.detail(videoId),
  )
  if (video.resource_type !== ResourceTypeEnum.Video) {
    notFound()
  }

  const rawPlaylist = resolvedSearchParams?.playlist
  const playlistId = resolveVideoPlaylist(videoPlaylistIds(video), rawPlaylist)

  // Canonical (slug + resolved playlist) is whatever the builder emits; redirect
  // if we're not on it, carrying incoming params except `playlist` (the builder
  // owns it — re-forwarding a rejected value would redirect again).
  const canonical = videoDetailPageView(
    videoId,
    playlistId ?? undefined,
    video.title,
  )
  const incomingBase = `/video/${id}/${slug}`
  // A repeated ?playlist (array) resolves as no-playlist but is never the
  // canonical form, so it always redirects (which strips it).
  const incoming = Array.isArray(rawPlaylist)
    ? null
    : typeof rawPlaylist === "string"
      ? `${incomingBase}?playlist=${rawPlaylist}`
      : incomingBase
  if (incoming !== canonical) {
    redirect(carrySearchParams(canonical, resolvedSearchParams, ["playlist"]))
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

  const rawT = resolvedSearchParams?.t
  const startTime =
    typeof rawT === "string" && /^\d+$/.test(rawT) ? Number(rawT) : undefined

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <VideoDetailPageRouter
        videoId={videoId}
        playlistId={playlistId}
        startTime={startTime}
      />
    </HydrationBoundary>
  )
}

export default Page
