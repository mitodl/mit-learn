import React from "react"
import { Metadata } from "next"
import DepartmentListingPage from "@/app-pages/DepartmentListingPage/DepartmentListingPage"
import { standardizeMetadata } from "@/common/metadata"
import { Hydrate } from "@tanstack/react-query"
import { learningResources } from "api/hooks/learningResources"
import { channels } from "api/hooks/channels"
import { prefetch } from "api/ssr/prefetch"

export const metadata: Metadata = standardizeMetadata({
  title: "Departments",
})

const Page: React.FC = async () => {
  const dehydratedState = await prefetch([
    channels.countsByType("department"),
    learningResources.schools(),
  ])

  return (
    <Hydrate state={dehydratedState}>
      <DepartmentListingPage />
    </Hydrate>
  )
}

export default Page
