import type { AppPageProps } from "@/common/searchParams"
import React from "react"
import AnalyticsContent from "@/app-pages/DashboardPage/AnalyticsContent"
import { standardizeMetadata } from "@/common/metadata"
import type { Metadata } from "next"

export const metadata: Metadata = standardizeMetadata({
  title: "Analytics",
  social: false,
})

const Page: React.FC<
  AppPageProps<"/dashboard/organization/[orgSlug]/analytics">
> = async ({ params }) => {
  const resolved = await params
  return <AnalyticsContent orgSlug={resolved.orgSlug} />
}

export default Page
