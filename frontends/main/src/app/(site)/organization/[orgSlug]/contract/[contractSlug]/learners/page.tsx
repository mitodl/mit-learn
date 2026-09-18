import type { AppPageProps } from "@/common/searchParams"
import React from "react"
import ContractLearnersPage from "@/app-pages/ContractLearnersPage/ContractLearnersPage"

const Page: React.FC<
  AppPageProps<"/organization/[orgSlug]/contract/[contractSlug]/learners">
> = async ({ params }) => {
  const resolved = await params
  return (
    <ContractLearnersPage
      orgSlug={resolved.orgSlug}
      contractSlug={resolved.contractSlug}
    />
  )
}

export default Page
