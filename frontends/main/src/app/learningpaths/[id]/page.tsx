import React from "react"
import { Permissions } from "@/common/permissions"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import LearningPathDetailsPage from "@/app-pages/LearningPathDetailsPage/LearningPathDetailsPage"

const Page: React.FC = () => {
  return (
    <RestrictedRoute requires={Permissions.LearningPathEditor}>
      <LearningPathDetailsPage />
    </RestrictedRoute>
  )
}

export default Page
