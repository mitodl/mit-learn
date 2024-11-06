import React from "react"
import { Metadata } from "next"
import DepartmentListingPage from "@/app-pages/DepartmentListingPage/DepartmentListingPage"
import { standardizeMetadata } from "@/common/metadata"
import { QueryClient, dehydrate, Hydrate } from "@tanstack/react-query"
import { learningResourcesKeyFactory } from "api/hooks/learningResources"
import { channelsKeyFactory } from "api/hooks/channels"

export const metadata: Metadata = standardizeMetadata({
  title: "Departments",
})

const Page: React.FC = async () => {
  const queryClient = new QueryClient()

  await Promise.all([
    queryClient.prefetchQuery(channelsKeyFactory.countsByType("department")),
    queryClient.prefetchQuery(learningResourcesKeyFactory.schools()),
  ])

  const dehydratedState = dehydrate(queryClient)

  return (
    <Hydrate state={dehydratedState}>
      <DepartmentListingPage />
    </Hydrate>
  )
}

export default Page
