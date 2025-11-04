import React from "react"
import type { Metadata } from "next"
import HomePage from "@/app-pages/HomePage/HomePage"
import { getMetadataAsync, safeGenerateMetadata } from "@/common/metadata"
import { HydrationBoundary } from "@tanstack/react-query"
import {
  learningResourceQueries,
  topicQueries,
} from "api/hooks/learningResources"
import { testimonialsQueries } from "api/hooks/testimonials"
import {
  NewsEventsListFeedTypeEnum,
  newsEventsQueries,
} from "api/hooks/newsEvents"
import { prefetch } from "api/ssr/prefetch"

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
  const { dehydratedState } = await prefetch([
    // Featured Courses carousel "All"
    learningResourceQueries.featured({
      limit: 12,
    }),
    // Featured Courses carousel "Free"
    learningResourceQueries.featured({
      limit: 12,
      free: true,
    }),
    // Featured Courses carousel "With Certificate"
    learningResourceQueries.featured({
      limit: 12,
      certification: true,
      professional: false,
    }),
    // Featured Courses carousel "Professional & Executive Learning"
    learningResourceQueries.featured({
      limit: 12,
      professional: true,
    }),
    // Media carousel "All"
    learningResourceQueries.list({
      resource_type: ["video", "podcast_episode"],
      limit: 12,
      sortby: "new",
    }),
    // Media carousel "Videos"
    learningResourceQueries.list({
      resource_type: ["video"],
      limit: 12,
      sortby: "new",
    }),
    // Media carousel "Podcasts"
    learningResourceQueries.list({
      resource_type: ["podcast_episode"],
      limit: 12,
      sortby: "new",
    }),
    // Browse by Topic
    topicQueries.list({ is_toplevel: true }),

    testimonialsQueries.list({ position: 1 }),
    newsEventsQueries.list({
      feed_type: [NewsEventsListFeedTypeEnum.Events],
      limit: 5,
      sortby: "event_date",
    }),
    newsEventsQueries.list({
      feed_type: [NewsEventsListFeedTypeEnum.News],
      limit: 6,
      sortby: "-news_date",
    }),
  ])

  return (
    <HydrationBoundary state={dehydratedState}>
      <HomePage heroImageIndex={Math.floor(Math.random() * 5) + 1} />
    </HydrationBoundary>
  )
}

export default Page
