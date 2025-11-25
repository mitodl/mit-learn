import React from "react"
import { Metadata } from "next"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { topicQueries } from "api/hooks/learningResources"
import { channelQueries } from "api/hooks/channels"
import TopicsListingPage from "@/app-pages/TopicsListingPage/TopicsListingPage"
import { getQueryClient } from "@/app/getQueryClient"

import { standardizeMetadata } from "@/common/metadata"
export const metadata: Metadata = standardizeMetadata({
  title: "Topics",
})

const Page: React.FC<PageProps<"/topics">> = async () => {
  const queryClient = getQueryClient()

  await Promise.all([
    queryClient.prefetchQuery(topicQueries.list({})),
    queryClient.prefetchQuery(channelQueries.countsByType("topic")),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TopicsListingPage />
    </HydrationBoundary>
  )
}

export default Page
