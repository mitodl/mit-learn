import type { AppPageProps } from "@/common/searchParams"
import React from "react"
import HomeContent from "@/app-pages/DashboardPage/HomeContent"

const Page: React.FC<AppPageProps<"/dashboard">> = () => {
  return <HomeContent />
}

export default Page
