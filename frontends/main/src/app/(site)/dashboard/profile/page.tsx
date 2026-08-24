import type { AppPageProps } from "@/common/searchParams"
import React from "react"
import { ProfileContent } from "@/app-pages/DashboardPage/ProfileContent"

const Page: React.FC<AppPageProps<"/dashboard/profile">> = () => {
  return <ProfileContent />
}

export default Page
