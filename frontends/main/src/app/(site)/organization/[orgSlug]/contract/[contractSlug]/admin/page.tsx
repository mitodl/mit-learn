import type { AppPageProps } from "@/common/searchParams"
import React from "react"
import ContractAdminPage from "@/app-pages/ContractAdminPage/ContractAdminPage"

const Page: React.FC<
  AppPageProps<"/organization/[orgSlug]/contract/[contractSlug]/admin">
> = async ({ params }) => {
  const resolved = await params
  return (
    <ContractAdminPage
      orgSlug={resolved.orgSlug}
      contractSlug={resolved.contractSlug}
    />
  )
}

export default Page
