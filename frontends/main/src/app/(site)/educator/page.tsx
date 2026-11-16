import React from "react"
import type { Metadata } from "next"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import {
  courseQueries,
  podcastEpisodeQueries,
  videoQueries,
} from "api/hooks/learningResources"
import type { AppPageProps } from "@/common/searchParams"
import { getMetadataAsync, safeGenerateMetadata } from "@/common/metadata"
import { getQueryClient } from "@/app/getQueryClient"
import EducatorPage from "@/app-pages/EducatorPage/EducatorPage"
import EducatorFlagGate from "./EducatorFlagGate"
import {
  SELECTED_COURSES_PARAMS,
  TEACHING_PODCAST_EPISODES_PARAMS,
  TEACHING_VIDEOS_PARAMS,
} from "@/app-pages/EducatorPage/queryParams"

/**
 * getMetadataAsync rather than standardizeMetadata: the course cards open the
 * resource drawer, so a `?resource=` variant of this page needs its own
 * metadata.
 */
export async function generateMetadata({
  searchParams,
}: AppPageProps<"/educator">): Promise<Metadata> {
  return safeGenerateMetadata(async () => {
    return await getMetadataAsync({
      title: "Bring MIT into your teaching",
      description:
        "Free course materials from MIT classrooms, ready to use and adapt in yours.",
      searchParams,
    })
  })
}

const Page: React.FC<AppPageProps<"/educator">> = async () => {
  const queryClient = getQueryClient()

  await Promise.all([
    queryClient.prefetchQuery(courseQueries.list(SELECTED_COURSES_PARAMS)),
    queryClient.prefetchQuery(videoQueries.list(TEACHING_VIDEOS_PARAMS)),
    queryClient.prefetchQuery(
      podcastEpisodeQueries.list(TEACHING_PODCAST_EPISODES_PARAMS),
    ),
  ])

  return (
    <EducatorFlagGate>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <EducatorPage />
      </HydrationBoundary>
    </EducatorFlagGate>
  )
}

export default Page
