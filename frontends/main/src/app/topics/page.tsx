import React from "react"
import { Metadata } from "next"
import { Hydrate } from "@tanstack/react-query"
import { prefetch } from "api/ssr/prefetch"
import { topicQueries } from "api/hooks/learningResources"
import { channels } from "api/hooks/channels"
import TopicsListingPage from "@/app-pages/TopicsListingPage/TopicsListingPage"

import { standardizeMetadata } from "@/common/metadata"
export const metadata: Metadata = standardizeMetadata({
  title: "Topics",
})

const Page: React.FC = async () => {
  const { dehydratedState } = await prefetch([
    topicQueries.list({}),
    channels.countsByType("topic"),
  ])

  return (
    <Hydrate state={dehydratedState}>
      <TopicsListingPage />
    </Hydrate>
  )
}

export default Page
