import React from "react"
import ContractContent from "@/app-pages/DashboardPage/ContractContent"

const Page: React.FC<
  PageProps<"/dashboard/organization/[orgSlug]/contract/[contractSlug]">
> = async ({ params }) => {
  const resolved = await params
  return (
    <ContractContent
      orgSlug={resolved.orgSlug}
      contractSlug={resolved.contractSlug}
    />
  )
}

export default Page
