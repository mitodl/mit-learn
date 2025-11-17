import React from "react"
import { Metadata } from "next"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { standardizeMetadata } from "@/common/metadata"
import { channelQueries } from "api/hooks/channels"
import UnitsListingPage from "@/app-pages/UnitsListingPage/UnitsListingPage"
import { getQueryClient } from "@/app/getQueryClient"

export const metadata: Metadata = standardizeMetadata({
  title: "Units",
})

const Page: React.FC<PageProps<"/units">> = async () => {
  const queryClient = getQueryClient()

  await Promise.all([
    queryClient.prefetchQuery(channelQueries.countsByType("unit")),
    queryClient.prefetchQuery(channelQueries.list({ channel_type: "unit" })),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UnitsListingPage />
    </HydrationBoundary>
  )
}

export default Page
