import React from "react"
import OrganizationContent from "@/app-pages/DashboardPage/OrganizationContent"
import invariant from "tiny-invariant"

const Page: React.FC<PageProps<"/dashboard/organization/[slug]">> = async ({
  params,
}) => {
  const resolved = await params
  invariant(resolved.slug, "slug is required")
  return <OrganizationContent orgSlug={resolved.slug} />
}

export default Page
