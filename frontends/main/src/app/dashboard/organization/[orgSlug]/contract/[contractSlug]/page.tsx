import React from "react"
import ContractContent from "@/app-pages/DashboardPage/ContractContent"
import invariant from "tiny-invariant"

const Page: React.FC<
  PageProps<"/dashboard/organization/[orgSlug]/contract/[contractSlug]">
> = async ({ params }) => {
  const resolved = await params
  invariant(resolved.orgSlug, "orgSlug is required")
  invariant(resolved.contractSlug, "contractSlug is required")
  return (
    <ContractContent
      orgSlug={resolved.orgSlug}
      contractSlug={resolved.contractSlug}
    />
  )
}

export default Page
