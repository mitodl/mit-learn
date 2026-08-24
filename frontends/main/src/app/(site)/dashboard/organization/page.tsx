import React from "react"
import OrganizationRedirect from "@/app-pages/DashboardPage/OrganizationRedirect"
import type { AppPageProps } from "@/common/searchParams"

const Page: React.FC<AppPageProps<"/dashboard/organization">> = async () => {
  return <OrganizationRedirect />
}

export default Page
