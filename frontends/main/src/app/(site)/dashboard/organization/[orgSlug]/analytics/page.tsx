import React from "react"
import AnalyticsContent from "@/app-pages/DashboardPage/AnalyticsContent"

const Page: React.FC<
  PageProps<"/dashboard/organization/[orgSlug]/analytics">
> = async ({ params }) => {
  const resolved = await params
  return <AnalyticsContent orgSlug={resolved.orgSlug} />
}

export default Page
