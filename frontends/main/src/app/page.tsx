import React from "react"
import type { Metadata } from "next"
import HomePage from "@/app-pages/HomePage/HomePage"
import { getMetadataAsync } from "@/common/metadata"
import { QueryClient, dehydrate, Hydrate } from "@tanstack/react-query"
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
    /* We can't do this until resources are fully public, https://github.com/mitodl/hq/issues/5159 */
    // queryClient.prefetchQuery(
    //   learningResourcesKeyFactory.topics({ is_toplevel: true }),
    // ),
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
