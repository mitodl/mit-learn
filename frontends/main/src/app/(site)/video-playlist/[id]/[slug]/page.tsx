import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { safeGenerateMetadata, standardizeMetadata } from "@/common/metadata"
import {
  learningResourceQueries,
  videoPlaylistQueries,
} from "api/hooks/learningResources"
import { getQueryClient } from "@/app/getQueryClient"
import VideoPlaylistCollectionPage from "@/app-pages/VideoPlaylistCollectionPage/VideoPlaylistCollectionPage"
import { notFound, redirect } from "next/navigation"
import { parseResourceId } from "@/common/slugs"
import { absoluteUrl, videoPlaylistPageView } from "@/common/urls"

type Props = PageProps<"/video-playlist/[id]/[slug]">

export const generateMetadata = async (props: Props) => {
  const { id } = await props.params
  const playlistId = parseResourceId(id)
  if (playlistId === null) {
    notFound()
  }
  const queryClient = getQueryClient()

  return safeGenerateMetadata(async () => {
    const [playlist, items] = await Promise.all([
      queryClient.fetchQuery(videoPlaylistQueries.detail(playlistId)),
      queryClient.fetchQuery(
        learningResourceQueries.items(playlistId, {
          learning_resource_id: playlistId,
          limit: 1,
        }),
      ),
    ])

    const firstVideoImage = items?.[0]?.image?.url
    const firstVideoImageAlt = items?.[0]?.image?.alt ?? undefined

    return standardizeMetadata({
      title: playlist.title,
      description: playlist.description ?? undefined,
      image: firstVideoImage ?? playlist.image?.url,
      imageAlt: firstVideoImage
        ? firstVideoImageAlt
        : (playlist.image?.alt ?? undefined),
      alternates: {
        canonical: absoluteUrl(
          videoPlaylistPageView(String(playlistId), playlist.title),
        ),
      },
    })
  })
}

const Page: React.FC<Props> = async ({ params }) => {
  const { id, slug } = await params
  const playlistId = parseResourceId(id)
  if (playlistId === null) {
    notFound()
  }
  const queryClient = getQueryClient()

  // Fetch the detail blocking so the slug is known before the redirect decision.
  const playlist = await queryClient.fetchQueryOr404(
    videoPlaylistQueries.detail(playlistId),
  )

  const canonical = videoPlaylistPageView(String(playlistId), playlist.title)
  if (`/video-playlist/${id}/${slug}` !== canonical) {
    redirect(canonical)
  }

  await queryClient.prefetchQuery(
    learningResourceQueries.items(playlistId, {
      learning_resource_id: playlistId,
    }),
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <VideoPlaylistCollectionPage playlistId={playlistId} />
    </HydrationBoundary>
  )
}

export default Page
