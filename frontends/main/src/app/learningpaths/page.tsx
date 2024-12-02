import React from "react"
import LearningPathListingPage from "@/app-pages/LearningPathListingPage/LearningPathListingPage"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { Permission } from "api/hooks/user"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"

export const metadata: Metadata = standardizeMetadata({
  title: "Learning Paths",
})

const Page: React.FC = () => {
  return (
    <RestrictedRoute requires={Permission.LearningPathEditor}>
      <LearningPathListingPage />
    </RestrictedRoute>
  )
}

export default Page
