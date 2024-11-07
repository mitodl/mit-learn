import React from "react"
import { Metadata } from "next"
import DepartmentListingPage from "@/app-pages/DepartmentListingPage/DepartmentListingPage"
import { standardizeMetadata } from "@/common/metadata"
import { Hydrate } from "@tanstack/react-query"
import { learningResourcesKeyFactory } from "api/hooks/learningResources"
import { channelsKeyFactory } from "api/hooks/channels"
import { prefetch } from "api/ssr/prefetch"

export const metadata: Metadata = standardizeMetadata({
  title: "Departments",
})

const Page: React.FC = async () => {
  const dehydratedState = await prefetch([
    channelsKeyFactory.countsByType("department"),
    channelsKeyFactory.countsByType("maybe"),
    learningResourcesKeyFactory.schools(),
  ])

  return (
    <Hydrate state={dehydratedState}>
      <DepartmentListingPage />
    </Hydrate>
  )
}

export default Page
