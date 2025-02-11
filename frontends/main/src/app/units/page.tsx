import React from "react"
import { Metadata } from "next"
import { HydrationBoundary } from "@tanstack/react-query"
import { prefetch } from "api/ssr/prefetch"
import { standardizeMetadata } from "@/common/metadata"
import { channelQueries } from "api/hooks/channels"
import UnitsListingPage from "@/app-pages/UnitsListingPage/UnitsListingPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Units",
})

const Page: React.FC = async () => {
  const { dehydratedState } = await prefetch([
    channelQueries.countsByType("unit"),
    channelQueries.list({ channel_type: "unit" }),
  ])

  return (
    <HydrationBoundary state={dehydratedState}>
      <UnitsListingPage />
    </HydrationBoundary>
  )
}

export default Page
