import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { Permissions } from "@/common/permissions"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import LearningPathListingPage from "@/app-pages/LearningPathListingPage/LearningPathListingPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Learning Paths",
})

const Page: React.FC = () => {
  return (
    <RestrictedRoute requires={Permissions.LearningPathEditor}>
      <LearningPathListingPage />
    </RestrictedRoute>
  )
}

export default Page
