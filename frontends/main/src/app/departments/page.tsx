import React from "react"
import { Metadata } from "next"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { standardizeMetadata } from "@/common/metadata"
import { schoolQueries } from "api/hooks/learningResources"
import { channelQueries } from "api/hooks/channels"
import DepartmentListingPage from "@/app-pages/DepartmentListingPage/DepartmentListingPage"
import { getQueryClient } from "@/app/getQueryClient"

export const metadata: Metadata = standardizeMetadata({
  title: "Departments",
})

const Page: React.FC<PageProps<"/departments">> = async () => {
  const queryClient = getQueryClient()

  await Promise.all([
    queryClient.prefetchQuery(channelQueries.countsByType("department")),
    queryClient.prefetchQuery(schoolQueries.list()),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DepartmentListingPage />
    </HydrationBoundary>
  )
}

export default Page
