import React from "react"
import { Metadata } from "next"
import { Hydrate } from "@tanstack/react-query"
import { prefetch } from "api/ssr/prefetch"
import { standardizeMetadata } from "@/common/metadata"
import { learningResources } from "api/hooks/learningResources"
import { channels } from "api/hooks/channels"
import type { PaginatedLearningResourceOfferorDetailList } from "api"
import UnitsListingPage from "@/app-pages/UnitsListingPage/UnitsListingPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Units",
})

const Page: React.FC = async () => {
  const { queryClient } = await prefetch([
    learningResources.offerors({}),
    channels.countsByType("unit"),
  ])

  const units = queryClient
    .getQueryData<PaginatedLearningResourceOfferorDetailList>(
      learningResources.offerors({}).queryKey,
    )!
    .results.filter((unit) => !!unit.value_prop)
    .map((unit) => unit.code)

  const { dehydratedState } = await prefetch(
    units.map((unit) => channels.detailByType("unit", unit)),
    queryClient,
  )

  return (
    <Hydrate state={dehydratedState}>
      <UnitsListingPage />
    </Hydrate>
  )
}

export default Page
