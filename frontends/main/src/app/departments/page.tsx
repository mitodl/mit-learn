import React from "react"
import { Metadata } from "next"
import { Hydrate } from "@tanstack/react-query"
import { standardizeMetadata } from "@/common/metadata"
import { schoolQueries } from "api/hooks/learningResources"
import { channelQueries } from "api/hooks/channels"
import { prefetch } from "api/ssr/prefetch"
import DepartmentListingPage from "@/app-pages/DepartmentListingPage/DepartmentListingPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Departments",
})

const Page: React.FC = async () => {
  const { dehydratedState } = await prefetch([
    channelQueries.countsByType("department"),
    schoolQueries.list(),
  ])

  return (
    <Hydrate state={dehydratedState}>
      <DepartmentListingPage />
    </Hydrate>
  )
}

export default Page
