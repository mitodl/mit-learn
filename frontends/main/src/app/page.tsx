import React from "react"
import type { Metadata } from "next"
import HomePage from "@/app-pages/HomePage/HomePage"
import { getMetadataAsync, safeGenerateMetadata } from "@/common/metadata"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import {
  learningResourceQueries,
  topicQueries,
} from "api/hooks/learningResources"
import { testimonialsQueries } from "api/hooks/testimonials"
import {
  NewsEventsListFeedTypeEnum,
  newsEventsQueries,
} from "api/hooks/newsEvents"
import { getQueryClient } from "@/app/getQueryClient"

const getRandomHeroImageIndex = () => Math.floor(Math.random() * 5) + 1

export async function generateMetadata({
  searchParams,
}: PageProps<"/">): Promise<Metadata> {
  return safeGenerateMetadata(async () => {
    return await getMetadataAsync({
      title: "Learn with MIT",
      searchParams,
    })
  })
}

const Page: React.FC<PageProps<"/">> = async () => {
  const queryClient = getQueryClient()

  await Promise.all([
    // Featured Courses carousel "All"
    queryClient.prefetchQuery(
      learningResourceQueries.featured({
        limit: 12,
      }),
    ),
    // Featured Courses carousel "Free"
    queryClient.prefetchQuery(
      learningResourceQueries.featured({
        limit: 12,
        free: true,
      }),
    ),
    // Featured Courses carousel "With Certificate"
    queryClient.prefetchQuery(
      learningResourceQueries.featured({
        limit: 12,
        certification: true,
        professional: false,
      }),
    ),
    // Featured Courses carousel "Professional & Executive Learning"
    queryClient.prefetchQuery(
      learningResourceQueries.featured({
        limit: 12,
        professional: true,
      }),
    ),
    // Media carousel "All"
    queryClient.prefetchQuery(
      learningResourceQueries.list({
        resource_type: ["video", "podcast_episode"],
        limit: 12,
        sortby: "new",
      }),
    ),
    // Media carousel "Videos"
    queryClient.prefetchQuery(
      learningResourceQueries.list({
        resource_type: ["video"],
        limit: 12,
        sortby: "new",
      }),
    ),
    // Media carousel "Podcasts"
    queryClient.prefetchQuery(
      learningResourceQueries.list({
        resource_type: ["podcast_episode"],
        limit: 12,
        sortby: "new",
      }),
    ),
    // Browse by Topic
    queryClient.prefetchQuery(topicQueries.list({ is_toplevel: true })),

    queryClient.prefetchQuery(testimonialsQueries.list({ position: 1 })),
    queryClient.prefetchQuery(
      newsEventsQueries.list({
        feed_type: [NewsEventsListFeedTypeEnum.Events],
        limit: 5,
        sortby: "event_date",
      }),
    ),
    queryClient.prefetchQuery(
      newsEventsQueries.list({
        feed_type: [NewsEventsListFeedTypeEnum.News],
        limit: 6,
        sortby: "-news_date",
      }),
    ),
  ])

  const heroImageIndex = getRandomHeroImageIndex()

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomePage heroImageIndex={heroImageIndex} />
    </HydrationBoundary>
  )
}

export default Page
