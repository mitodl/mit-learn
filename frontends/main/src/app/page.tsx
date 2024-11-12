import React from "react"
import type { Metadata } from "next"
import HomePage from "@/app-pages/HomePage/HomePage"
import { getMetadataAsync } from "@/common/metadata"
import { Hydrate } from "@tanstack/react-query"
import { learningResourcesKeyFactory } from "api/hooks/learningResources"
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
