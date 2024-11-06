import React from "react"
import type { Metadata } from "next"
import HomePage from "@/app-pages/HomePage/HomePage"
import { getMetadataAsync } from "@/common/metadata"
import { QueryClient, dehydrate, Hydrate } from "@tanstack/react-query"
// import { learningResourcesKeyFactory } from "api/hooks/learningResources"
import { testimonialsKeyFactory } from "api/hooks/testimonials"
import {
  NewsEventsListFeedTypeEnum,
  newsEventsKeyFactory,
} from "api/hooks/newsEvents"

type SearchParams = {
  [key: string]: string | string[] | undefined
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}): Promise<Metadata> {
  return await getMetadataAsync({
    title: "Learn with MIT",
    searchParams,
  })
}

const Page: React.FC = async () => {
  const queryClient = new QueryClient()

  await Promise.all([
    /* We can't prefetch any learning resource until they are fully public, https://github.com/mitodl/hq/issues/5159

    // The queries for carousel content are not checked in the query cache warnings as the use the key factory methods directly

    // Featured Courses carousel "All"
    queryClient.prefetchQuery(
      learningResourcesKeyFactory.featured({
        limit: 12,
      }),
    ),
    // Featured Courses carousel "Free" (worth fetching for tabs not shown on load?)
    queryClient.prefetchQuery(
      learningResourcesKeyFactory.featured({
        limit: 12,
        free: true,
      }),
    ),
    // Featured Courses carousel "With Certificate"
    queryClient.prefetchQuery(
      learningResourcesKeyFactory.featured({
        limit: 12,
        certification: true,
        professional: false,
      }),
    ),
    // Featured Courses carousel "Professional & Executive Learning"
    queryClient.prefetchQuery(
      learningResourcesKeyFactory.featured({
        limit: 12,
        certification: true,
        professional: false,
      }),
    ),
    // Media carousel "All"
    queryClient.prefetchQuery(
      learningResourcesKeyFactory.list({
        resource_type: ["video", "podcast_episode"],
        limit: 12,
        sortby: "new",
      }),
    ),
    // Media carousel "Videos"
    queryClient.prefetchQuery(
      learningResourcesKeyFactory.list({
        resource_type: ["video"],
        limit: 12,
        sortby: "new",
      }),
    ),
    // Media carousel "Podcasts"
    queryClient.prefetchQuery(
      learningResourcesKeyFactory.list({
        resource_type: ["podcast_episode"],
        limit: 12,
        sortby: "new",
      }),
    ),
    // Browse by Topic
    queryClient.prefetchQuery(
      learningResourcesKeyFactory.topics({ is_toplevel: true }),
    ),
    */

    queryClient.prefetchQuery(testimonialsKeyFactory.list({ position: 1 })),
    queryClient.prefetchQuery(
      newsEventsKeyFactory.list({
        feed_type: [NewsEventsListFeedTypeEnum.News],
        limit: 6,
        sortby: "-news_date",
      }),
    ),
    queryClient.prefetchQuery(
      newsEventsKeyFactory.list({
        feed_type: [NewsEventsListFeedTypeEnum.Events],
        limit: 5,
        sortby: "event_date",
      }),
    ),
  ])

  const dehydratedState = dehydrate(queryClient)

  return (
    <Hydrate state={dehydratedState}>
      <HomePage />
    </Hydrate>
  )
}

export default Page
