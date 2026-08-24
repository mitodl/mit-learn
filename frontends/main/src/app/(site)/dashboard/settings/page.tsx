import type { AppPageProps } from "@/common/searchParams"
import React from "react"
import { SettingsContent } from "@/app-pages/DashboardPage/SettingsContent"

const Page: React.FC<AppPageProps<"/dashboard/settings">> = () => {
  return <SettingsContent />
}

export default Page
