import type { AppPageProps } from "@/common/searchParams"
import React from "react"
import { Permission } from "api/hooks/user"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import LearningPathDetailsPage from "@/app-pages/LearningPathDetailsPage/LearningPathDetailsPage"

const Page: React.FC<AppPageProps<"/learningpaths/[id]">> = () => {
  return (
    <RestrictedRoute requires={Permission.LearningPathEditor}>
      <LearningPathDetailsPage />
    </RestrictedRoute>
  )
}

export default Page
