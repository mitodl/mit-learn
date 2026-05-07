import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { safeGenerateMetadata, standardizeMetadata } from "@/common/metadata"
import {
  learningResourceQueries,
  videoPlaylistQueries,
} from "api/hooks/learningResources"
import { getQueryClient } from "@/app/getQueryClient"
import VideoPlaylistCollectionPage from "@/app-pages/VideoPlaylistCollectionPage/VideoPlaylistCollectionPage"
import { notFound } from "next/navigation"

export const generateMetadata = async (
  props: PageProps<"/video-playlist/[id]">,
) => {
  const { id } = await props.params
  const playlistId = Number(id)
  if (!Number.isInteger(playlistId) || playlistId <= 0) {
    notFound()
  }
  const queryClient = getQueryClient()

  return safeGenerateMetadata(async () => {
    const [playlist, items] = await Promise.all([
      queryClient.fetchQuery(videoPlaylistQueries.detail(playlistId)),
      queryClient.fetchQuery(
        learningResourceQueries.items(playlistId, {
          learning_resource_id: playlistId,
        }),
      ),
    ])

    const firstVideoImage = items?.[0]?.image?.url
    const firstVideoImageAlt = items?.[0]?.image?.alt ?? undefined

    return standardizeMetadata({
      title: playlist.title,
      description: playlist.description ?? "Learn Video Playlist",
      image: firstVideoImage ?? playlist.image?.url,
      imageAlt: firstVideoImage
        ? firstVideoImageAlt
        : (playlist.image?.alt ?? undefined),
      robots: "noindex, nofollow",
    })
  })
}

const Page: React.FC<PageProps<"/video-playlist/[id]">> = async ({
  params,
}) => {
  const { id } = await params
  const playlistId = Number(id)
  if (!Number.isInteger(playlistId) || playlistId <= 0) {
    notFound()
  }
  const queryClient = getQueryClient()

  await Promise.all([
    queryClient.prefetchQuery(videoPlaylistQueries.detail(playlistId)),
    queryClient.prefetchQuery(
      learningResourceQueries.items(playlistId, {
        learning_resource_id: playlistId,
      }),
    ),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <VideoPlaylistCollectionPage playlistId={playlistId} />
    </HydrationBoundary>
  )
}

export default Page
