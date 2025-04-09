import React from "react"
import OrganizationContent from "@/app-pages/DashboardPage/OrganizationContent"
import { PageParams } from "@/app/types"
import invariant from "tiny-invariant"

const Page: React.FC<PageParams<object, { id: string }>> = async ({
  params,
}) => {
  const resolved = await params
  invariant(resolved?.id, "id is required")
  return <OrganizationContent orgId={Number(resolved.id)} />
}

export default Page
