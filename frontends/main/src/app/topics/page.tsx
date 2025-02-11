import React from "react"
import { Metadata } from "next"
import { HydrationBoundary } from "@tanstack/react-query"
import { prefetch } from "api/ssr/prefetch"
import { topicQueries } from "api/hooks/learningResources"
import { channelQueries } from "api/hooks/channels"
import TopicsListingPage from "@/app-pages/TopicsListingPage/TopicsListingPage"

import { standardizeMetadata } from "@/common/metadata"
export const metadata: Metadata = standardizeMetadata({
  title: "Topics",
})

const Page: React.FC = async () => {
  const { dehydratedState } = await prefetch([
    topicQueries.list({}),
    channelQueries.countsByType("topic"),
  ])

  return (
    <HydrationBoundary state={dehydratedState}>
      <TopicsListingPage />
    </HydrationBoundary>
  )
}

export default Page
