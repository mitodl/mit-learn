import React from "react"
import type { Metadata } from "next"
import HomePage from "@/app-pages/HomePage/HomePage"
import { getMetadataAsync } from "@/common/metadata"
import { Hydrate } from "@tanstack/react-query"
// import { learningResourcesKeyFactory } from "api/hooks/learningResources"
import { testimonialsKeyFactory } from "api/hooks/testimonials"
import {
  NewsEventsListFeedTypeEnum,
  newsEventsKeyFactory,
} from "api/hooks/newsEvents"
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
  const dehydratedState = await prefetch([
    /* We can't prefetch any learning resource until they are fully public, https://github.com/mitodl/hq/issues/5159

    // The queries for carousel content are not checked in the query cache warnings as the use the key factory methods directly

    // Featured Courses carousel "All"
    learningResourcesKeyFactory.featured({
      limit: 12,
    }),
    // Featured Courses carousel "Free" (worth fetching for tabs not shown on load?)
    learningResourcesKeyFactory.featured({
      limit: 12,
      free: true,
    }),
    // Featured Courses carousel "With Certificate"
    learningResourcesKeyFactory.featured({
      limit: 12,
      certification: true,
      professional: false,
    }),
    // Featured Courses carousel "Professional & Executive Learning"
    learningResourcesKeyFactory.featured({
      limit: 12,
      certification: true,
      professional: false,
    }),
    // Media carousel "All"
    learningResourcesKeyFactory.list({
      resource_type: ["video", "podcast_episode"],
      limit: 12,
      sortby: "new",
    }),
    // Media carousel "Videos"
    learningResourcesKeyFactory.list({
      resource_type: ["video"],
      limit: 12,
      sortby: "new",
    }),
    // Media carousel "Podcasts"
    learningResourcesKeyFactory.list({
      resource_type: ["podcast_episode"],
      limit: 12,
      sortby: "new",
    }),
    // Browse by Topic
    learningResourcesKeyFactory.topics({ is_toplevel: true }),
    */

    testimonialsKeyFactory.list({ position: 1 }),
    newsEventsKeyFactory.list({
      feed_type: [NewsEventsListFeedTypeEnum.News],
      limit: 6,
      sortby: "-news_date",
    }),
    newsEventsKeyFactory.list({
      feed_type: [NewsEventsListFeedTypeEnum.Events],
      limit: 5,
      sortby: "event_date",
    }),
  ])

  return (
    <Hydrate state={dehydratedState}>
      <HomePage />
    </Hydrate>
  )
}

export default Page
