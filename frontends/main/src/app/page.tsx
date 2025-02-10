import React from "react"
import type { Metadata } from "next"
import HomePage from "@/app-pages/HomePage/HomePage"
import { getMetadataAsync } from "@/common/metadata"
import { Hydrate } from "@tanstack/react-query"
import {
  learningResourceQueries,
  topicQueries,
} from "api/hooks/learningResources"
import { testimonials } from "api/hooks/testimonials"
import { NewsEventsListFeedTypeEnum, newsEvents } from "api/hooks/newsEvents"
import { prefetch } from "api/ssr/prefetch"

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

    testimonials.list({ position: 1 }),
    newsEvents.list({
      feed_type: [NewsEventsListFeedTypeEnum.Events],
      limit: 5,
      sortby: "event_date",
    }),
    newsEvents.list({
      feed_type: [NewsEventsListFeedTypeEnum.News],
      limit: 6,
      sortby: "-news_date",
    }),
  ])

  return (
    <Hydrate state={dehydratedState}>
      <HomePage heroImageIndex={Math.floor(Math.random() * 5) + 1} />
    </Hydrate>
  )
}

export default Page
