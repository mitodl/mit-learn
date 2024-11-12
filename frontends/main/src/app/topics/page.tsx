import React from "react"
import { Metadata } from "next"
import { Hydrate } from "@tanstack/react-query"
import { prefetch } from "api/ssr/prefetch"
import { learningResourcesKeyFactory } from "api/hooks/learningResources"
import { channelsKeyFactory } from "api/hooks/channels"

import { standardizeMetadata } from "@/common/metadata"
export const metadata: Metadata = standardizeMetadata({
  title: "Topics",
})

import TopicsListingPage from "@/app-pages/TopicsListingPage/TopicsListingPage"

const Page: React.FC = async () => {
  const dehydratedState = await prefetch([
    learningResourcesKeyFactory.topics({}),
    channelsKeyFactory.countsByType("topic"),
  ])

  return (
    <Hydrate state={dehydratedState}>
      <TopicsListingPage />
    </Hydrate>
  )
}

export default Page
