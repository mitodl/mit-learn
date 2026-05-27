import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { Permission } from "api/hooks/user"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import LearningPathListingPage from "@/app-pages/LearningPathListingPage/LearningPathListingPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Learning Paths",
})

const Page: React.FC<PageProps<"/learningpaths">> = () => {
  return (
    <RestrictedRoute requires={Permission.LearningPathEditor}>
      <LearningPathListingPage />
    </RestrictedRoute>
  )
}

export default Page
