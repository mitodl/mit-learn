import React from "react"
import OrganizationContent from "@/app-pages/DashboardPage/OrganizationContent"
import { PageParams } from "@/app/types"
import invariant from "tiny-invariant"

const Page: React.FC<PageParams<object, { slug: string }>> = async ({
  params,
}) => {
  const resolved = await params
  invariant(resolved?.slug, "slug is required")
  return <OrganizationContent orgSlug={resolved?.slug} />
}

export default Page
